const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CarChain Smart Contracts Test Suite", function () {
  let VehicleRegistry, vehicleRegistry;
  let CarChainEscrow, escrow;
  let owner, buyer, seller, garage, inspector, otherAccount;

  const sampleVin = "1HGCR2F83HA000001";
  const sampleVin2 = "WBA33AY08NFP00002";
  const tokenUri = "https://ipfs.io/ipfs/QmCarChainMetaSample";
  const initialMileage = 45000;

  beforeEach(async function () {
    [owner, buyer, seller, garage, inspector, otherAccount] = await ethers.getSigners();

    // Deploy VehicleRegistry
    VehicleRegistry = await ethers.getContractFactory("VehicleRegistry");
    vehicleRegistry = await VehicleRegistry.deploy(owner.address);
    await vehicleRegistry.waitForDeployment();

    // Deploy CarChainEscrow
    CarChainEscrow = await ethers.getContractFactory("CarChainEscrow");
    escrow = await CarChainEscrow.deploy(await vehicleRegistry.getAddress(), owner.address);
    await escrow.waitForDeployment();

    // Authorize garage and inspector
    await vehicleRegistry.setGarageAuthorization(garage.address, true);
    await vehicleRegistry.setInspectorAuthorization(inspector.address, true);
  });

  describe("VehicleRegistry - Digital Vehicle Passport", function () {
    it("Should mint a vehicle passport NFT successfully", async function () {
      const tx = await vehicleRegistry.mintPassport(seller.address, sampleVin, tokenUri, initialMileage);
      await tx.wait();

      expect(await vehicleRegistry.totalMinted()).to.equal(1);
      const tokenId = await vehicleRegistry.getTokenIdByVin(sampleVin);
      expect(tokenId).to.equal(1);
      expect(await vehicleRegistry.ownerOf(tokenId)).to.equal(seller.address);

      const vehicle = await vehicleRegistry.getVehicle(tokenId);
      expect(vehicle.vin).to.equal(sampleVin);
      expect(vehicle.currentMileage).to.equal(initialMileage);
      expect(vehicle.ownerAddr).to.equal(seller.address);
      expect(vehicle.uri).to.equal(tokenUri);
    });

    it("Should reject duplicate VIN minting", async function () {
      await vehicleRegistry.mintPassport(seller.address, sampleVin, tokenUri, initialMileage);

      await expect(
        vehicleRegistry.mintPassport(buyer.address, sampleVin, "new-uri", 50000)
      ).to.be.revertedWith("VehicleRegistry: VIN already minted");
    });

    it("Should enforce anti-rollback: prevent mileage reduction", async function () {
      await vehicleRegistry.mintPassport(seller.address, sampleVin, tokenUri, initialMileage);
      const tokenId = 1;

      // Updating to lower mileage must revert
      await expect(
        vehicleRegistry.connect(seller).updateMileage(tokenId, initialMileage - 5000)
      ).to.be.revertedWith("VehicleRegistry: Anti-rollback violation: New mileage cannot be lower than current mileage");

      // Valid forward mileage update succeeds
      await vehicleRegistry.connect(seller).updateMileage(tokenId, initialMileage + 2500);
      const vehicle = await vehicleRegistry.getVehicle(tokenId);
      expect(vehicle.currentMileage).to.equal(initialMileage + 2500);
    });

    it("Should allow authorized garage to record maintenance service and advance odometer", async function () {
      await vehicleRegistry.mintPassport(seller.address, sampleVin, tokenUri, initialMileage);
      const tokenId = 1;
      const newMileage = 52000;
      const recordHash = "0xhashofmaintenancedata123";

      await vehicleRegistry.connect(garage).recordService(tokenId, "Major Brake & Oil Service", newMileage, recordHash);

      const history = await vehicleRegistry.getServiceHistory(tokenId);
      expect(history.length).to.equal(1);
      expect(history[0].serviceType).to.equal("Major Brake & Oil Service");
      expect(history[0].mileage).to.equal(newMileage);
      expect(history[0].recordedBy).to.equal(garage.address);

      const vehicle = await vehicleRegistry.getVehicle(tokenId);
      expect(vehicle.currentMileage).to.equal(newMileage);
    });

    it("Should reject unauthorized accounts from recording services", async function () {
      await vehicleRegistry.mintPassport(seller.address, sampleVin, tokenUri, initialMileage);
      await expect(
        vehicleRegistry.connect(otherAccount).recordService(1, "Fake Service", 60000, "0xhash")
      ).to.be.revertedWith("VehicleRegistry: Caller is not an authorized garage");
    });

    it("Should allow authorized inspector to record vehicle inspection", async function () {
      await vehicleRegistry.mintPassport(seller.address, sampleVin, tokenUri, initialMileage);
      const tokenId = 1;
      const certHash = "0xhashofsafetycert456";

      await vehicleRegistry.connect(inspector).recordInspection(tokenId, "passed", initialMileage + 100, certHash);

      const inspections = await vehicleRegistry.getInspectionHistory(tokenId);
      expect(inspections.length).to.equal(1);
      expect(inspections[0].result).to.equal("passed");
      expect(inspections[0].inspector).to.equal(inspector.address);
    });
  });

  describe("CarChainEscrow - Purchase and Handover Workflow", function () {
    const depositAmount = ethers.parseEther("2.5");

    beforeEach(async function () {
      await vehicleRegistry.mintPassport(seller.address, sampleVin, tokenUri, initialMileage);
    });

    it("Should create and fund an escrow successfully", async function () {
      const tx = await escrow.connect(buyer).createAndFundEscrow(1, sampleVin, seller.address, {
        value: depositAmount,
      });
      await tx.wait();

      expect(await escrow.totalOrders()).to.equal(1);

      const order = await escrow.getOrder(1);
      expect(order.buyer).to.equal(buyer.address);
      expect(order.seller).to.equal(seller.address);
      expect(order.amount).to.equal(depositAmount);
      expect(order.state).to.equal(1); // EscrowState.Funded
    });

    it("Should complete escrow and release funds to seller when buyer confirms handover", async function () {
      await escrow.connect(buyer).createAndFundEscrow(1, sampleVin, seller.address, {
        value: depositAmount,
      });

      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);

      // Buyer confirms handover
      const confirmTx = await escrow.connect(buyer).confirmHandover(1);
      await confirmTx.wait();

      const order = await escrow.getOrder(1);
      expect(order.state).to.equal(3); // EscrowState.Completed
      expect(order.amount).to.equal(0);
      expect(order.buyerConfirmed).to.be.true;

      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(depositAmount);
    });

    it("Should reject handover confirmation from non-buyer", async function () {
      await escrow.connect(buyer).createAndFundEscrow(1, sampleVin, seller.address, {
        value: depositAmount,
      });

      await expect(
        escrow.connect(seller).confirmHandover(1)
      ).to.be.revertedWith("CarChainEscrow: Caller is not the buyer");
    });

    it("Should allow refunding the buyer if authorized", async function () {
      await escrow.connect(buyer).createAndFundEscrow(1, sampleVin, seller.address, {
        value: depositAmount,
      });

      const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);

      // Seller cancels/authorizes refund
      await escrow.connect(seller).refundBuyer(1);

      const order = await escrow.getOrder(1);
      expect(order.state).to.equal(4); // EscrowState.Refunded
      expect(order.amount).to.equal(0);

      const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
      expect(buyerBalanceAfter - buyerBalanceBefore).to.equal(depositAmount);
    });
  });
});
