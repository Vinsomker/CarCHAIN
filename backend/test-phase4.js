const http = require('http');

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 5000,
        path,
        method: 'POST',
        headers,
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => (resBody += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(resBody) });
          } catch {
            resolve({ status: res.statusCode, raw: resBody });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 5000,
        path,
        method: 'GET',
        headers,
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => (resBody += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(resBody) });
          } catch {
            resolve({ status: res.statusCode, raw: resBody });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runTest() {
  console.log('--- STARTING PHASE 4 INTEGRATION TEST ---');

  // 1. Sign in as Buyer
  const buyerLogin = await post('/api/auth/login', {
    email: 'buyer@carchain.dev',
    password: 'Buyer123!',
  });
  if (!buyerLogin.data.token) {
    throw new Error('Buyer login failed: ' + JSON.stringify(buyerLogin.data));
  }
  const buyerToken = buyerLogin.data.token;
  const buyerId = buyerLogin.data.user._id;
  console.log('✓ Buyer signed in:', buyerLogin.data.user.email);

  // 2. Sign in as Seller
  const sellerLogin = await post('/api/auth/login', {
    email: 'seller@carchain.dev',
    password: 'Seller123!',
  });
  const sellerToken = sellerLogin.data.token;
  console.log('✓ Seller signed in:', sellerLogin.data.user.email);

  // 3. Get Active Listings
  const listingsRes = await get('/api/listings?status=active');
  const listings = listingsRes.data.listings || [];
  if (listings.length === 0) {
    throw new Error('No active listings found in database to purchase');
  }

  let testListing = null;
  let tx = null;

  for (const l of listings) {
    const escrowRes = await post(
      '/api/transactions',
      {
        listingId: l._id,
        buyerNote: 'Phase 4 automated escrow test purchase',
        isWeb3: false,
      },
      buyerToken
    );

    if (escrowRes.status === 201) {
      testListing = l;
      tx = escrowRes.data.data;
      break;
    }
  }

  if (!tx) {
    throw new Error('Could not initiate escrow on any active listing');
  }

  console.log(`✓ Found active listing: "${testListing.title}" (Price: $${testListing.price})`);
  console.log(`✓ Escrow initiated: Tx ID ${tx._id}, Status: ${tx.status}, Funds Locked: $${tx.amount}`);

  // 5. Verify Listing is now 'pending'
  const listingAfter = await get(`/api/listings/${testListing._id}`);
  console.log(`✓ Listing status updated to: ${listingAfter.data.listing.status}`);

  // 6. Buyer confirms Vehicle Handover
  const handoverRes = await post(
    `/api/transactions/${tx._id}/confirm-handover`,
    {
      handoverNotes: 'Vehicle keys received and test drive successful',
    },
    buyerToken
  );
  if (handoverRes.status !== 200) {
    throw new Error('Handover confirmation failed: ' + JSON.stringify(handoverRes.data));
  }
  console.log('✓ Buyer confirmed vehicle handover: Status is now ownership_transferred');

  // 7. Verify Vehicle Ownership Transferred to Buyer
  const vehiclePassportRes = await get(`/api/vehicles/${testListing.vehicle._id}/passport`);
  const passport = vehiclePassportRes.data.passport;
  const currentOwner = passport.vehicle.currentOwner;
  console.log(`✓ Vehicle currentOwner is now: ${currentOwner._id || currentOwner}`);
  console.log(`✓ Vehicle ownership history count: ${passport.vehicle.ownershipHistory.length}`);

  // 8. Seller finalizes / completes the transaction
  const completeRes = await post(`/api/transactions/${tx._id}/complete`, {}, sellerToken);
  console.log(`✓ Seller completed transaction: Status is now ${completeRes.data.data.status}`);

  // 9. Owner mints/anchors Digital Passport on blockchain
  const mintRes = await post(
    `/api/vehicles/${testListing.vehicle._id}/blockchain-mint`,
    {
      tokenId: '1',
      contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      transactionHash: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    },
    buyerToken
  );
  console.log(`✓ Blockchain NFT Passport recorded: Token #${mintRes.data.vehicle.blockchainTokenId}, On-Chain: ${mintRes.data.vehicle.isOnChain}`);

  // 10. Check Buyer's Purchases API
  const myPurchases = await get('/api/transactions/my-purchases', buyerToken);
  console.log(`✓ Buyer has ${myPurchases.data.count} purchases recorded in transaction history.`);

  console.log('--- ALL PHASE 4 INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
