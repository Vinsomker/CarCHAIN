/**
 * CarChain Database Seed Script
 * Creates demo users, vehicles, listings, and digital passport records for testing.
 *
 * Usage:
 *   cd backend
 *   node utils/seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const Listing = require('../models/Listing');
const MaintenanceRecord = require('../models/MaintenanceRecord');
const InspectionCertificate = require('../models/InspectionCertificate');

async function seed() {
  try {
    console.log('🌱 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Admin
    let admin = await User.findOne({ email: 'admin@carchain.dev' });
    if (!admin) {
      admin = await User.create({
        firstName: 'CarChain',
        lastName: 'Admin',
        email: 'admin@carchain.dev',
        password: 'Admin123!',
        role: 'admin',
        approvalStatus: 'approved',
        isActive: true,
      });
      console.log('✅ Admin user created: admin@carchain.dev / Admin123!');
    }

    // 2. Buyer
    let buyer = await User.findOne({ email: 'buyer@carchain.dev' });
    if (!buyer) {
      buyer = await User.create({
        firstName: 'David',
        lastName: 'Buyer',
        email: 'buyer@carchain.dev',
        password: 'Buyer123!',
        role: 'buyer',
        approvalStatus: 'approved',
      });
      console.log('✅ Buyer created: buyer@carchain.dev / Buyer123!');
    }

    // 3. Seller
    let seller = await User.findOne({ email: 'seller@carchain.dev' });
    if (!seller) {
      seller = await User.create({
        firstName: 'Marcus',
        lastName: 'Vance',
        email: 'seller@carchain.dev',
        password: 'Seller123!',
        role: 'seller',
        approvalStatus: 'approved',
        phone: '+1 555-0199',
        businessName: 'Vance Automotive',
      });
      console.log('✅ Seller created: seller@carchain.dev / Seller123!');
    }

    // 4. Certified Garage (Approved)
    let garage = await User.findOne({ email: 'garage@carchain.dev' });
    if (!garage) {
      garage = await User.create({
        firstName: 'Robert',
        lastName: 'Miller',
        email: 'garage@carchain.dev',
        password: 'Garage123!',
        role: 'garage',
        businessName: 'Apex Performance Motors',
        businessLicense: 'GAR-NYC-88219',
        approvalStatus: 'approved',
      });
      console.log('✅ Garage created: garage@carchain.dev / Garage123!');
    } else if (garage.approvalStatus !== 'approved') {
      garage.approvalStatus = 'approved';
      await garage.save();
    }

    // 5. Certified Inspector (Approved)
    let inspector = await User.findOne({ email: 'inspector@carchain.dev' });
    if (!inspector) {
      inspector = await User.create({
        firstName: 'Elena',
        lastName: 'Rostova',
        email: 'inspector@carchain.dev',
        password: 'Inspector123!',
        role: 'inspector',
        businessName: 'TUV Certified Inspections',
        businessLicense: 'INS-CERT-4410',
        approvalStatus: 'approved',
      });
      console.log('✅ Inspector created: inspector@carchain.dev / Inspector123!');
    }

    // ─── 6. Demo Vehicles & Listings ───────────────────────────────────────────
    const demoVehiclesData = [
      {
        vin: 'WBA33AY08NFP28914',
        make: 'BMW',
        model: 'M340i xDrive',
        year: 2023,
        bodyType: 'sedan',
        color: 'Portimao Blue Metallic',
        fuelType: 'gasoline',
        transmission: 'automatic',
        engineSize: '3.0L Turbo I6',
        horsepower: 382,
        currentMileage: 28400,
        mileageUnit: 'km',
        doors: 4,
        seats: 5,
        driveType: 'awd',
        price: 48900,
        currency: 'USD',
        title: '2023 BMW M340i xDrive – M Sport Package, Clean Title',
        description:
          'Stunning BMW M340i xDrive in Portimao Blue. Always garaged, single owner, complete dealer service history anchored on CarChain digital passport. Premium Package, Harman Kardon audio, Adaptive M suspension.',
        imageUrl:
          'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80',
        location: { city: 'Munich', state: 'Bavaria', country: 'Germany' },
      },
      {
        vin: 'WP0AB2A99NS248102',
        make: 'Porsche',
        model: '911 Carrera S',
        year: 2022,
        bodyType: 'coupe',
        color: 'Agate Grey Metallic',
        fuelType: 'gasoline',
        transmission: 'automatic',
        engineSize: '3.0L Twin-Turbo Flat-6',
        horsepower: 443,
        currentMileage: 14200,
        mileageUnit: 'km',
        doors: 2,
        seats: 4,
        driveType: 'rwd',
        price: 119500,
        currency: 'USD',
        title: '2022 Porsche 911 Carrera S (992) – Sport Chrono, Clean History',
        description:
          'Flawless 992 Carrera S with Sport Chrono package, Sport Exhaust, 18-way adaptive sport seats, and front axle lift system. Protected with full front PPF. Full CarChain verification available.',
        imageUrl:
          'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
        location: { city: 'Stuttgart', state: 'Baden-Württemberg', country: 'Germany' },
      },
      {
        vin: '5YJ3E1EB5NF182930',
        make: 'Tesla',
        model: 'Model 3 Long Range',
        year: 2023,
        bodyType: 'sedan',
        color: 'Pearl White Multi-Coat',
        fuelType: 'electric',
        transmission: 'automatic',
        engineSize: 'Dual Motor AWD',
        horsepower: 346,
        currentMileage: 21500,
        mileageUnit: 'km',
        doors: 4,
        seats: 5,
        driveType: 'awd',
        price: 36800,
        currency: 'USD',
        title: '2023 Tesla Model 3 Long Range Dual Motor – FSD Computer & HW4',
        description:
          'Pristine condition Model 3 Long Range AWD with 576 km range. Heated seats front & rear, heat pump, battery health certified at 98.4%. Digital passport with full battery & software history.',
        imageUrl:
          'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=1200&q=80',
        location: { city: 'Oslo', state: 'Eastern Norway', country: 'Norway' },
      },
      {
        vin: 'WAUZZZF27MA091823',
        make: 'Audi',
        model: 'RS6 Avant',
        year: 2021,
        bodyType: 'wagon',
        color: 'Nardo Grey',
        fuelType: 'gasoline',
        transmission: 'automatic',
        engineSize: '4.0L Twin-Turbo V8 Mild-Hybrid',
        horsepower: 591,
        currentMileage: 38700,
        mileageUnit: 'km',
        doors: 5,
        seats: 5,
        driveType: 'awd',
        price: 94500,
        currency: 'USD',
        title: '2021 Audi RS6 Avant – Dynamic Package Plus, Ceramic Brakes',
        description:
          'Iconic RS6 Avant finished in legendary Nardo Grey. Dynamic Plus Package (305 km/h top speed unlock), Carbon Ceramic brakes, Bang & Olufsen 3D Advanced sound. Complete dealer records on digital passport.',
        imageUrl:
          'https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?auto=format&fit=crop&w=1200&q=80',
        location: { city: 'Zurich', state: 'Zurich', country: 'Switzerland' },
      },
      {
        vin: 'JTMAB3FV9RD109842',
        make: 'Toyota',
        model: 'RAV4 Hybrid',
        year: 2024,
        bodyType: 'suv',
        color: 'Magnetic Gray Metallic',
        fuelType: 'hybrid',
        transmission: 'automatic',
        engineSize: '2.5L 4-Cylinder Hybrid',
        horsepower: 219,
        currentMileage: 9800,
        mileageUnit: 'km',
        doors: 5,
        seats: 5,
        driveType: 'awd',
        price: 33900,
        currency: 'USD',
        title: '2024 Toyota RAV4 Hybrid XSE – Electronic On-Demand AWD',
        description:
          'Like-new RAV4 Hybrid XSE with two-tone black roof. Toyota Safety Sense 2.5, SofTex seating, 10.5-inch multimedia display. Ultra reliable with remaining manufacturer warranty.',
        imageUrl:
          'https://images.unsplash.com/photo-1581540222194-0def2dda95b8?auto=format&fit=crop&w=1200&q=80',
        location: { city: 'Denver', state: 'Colorado', country: 'United States' },
      },
    ];

    for (const vData of demoVehiclesData) {
      let vehicle = await Vehicle.findOne({ vin: vData.vin });
      if (!vehicle) {
        vehicle = await Vehicle.create({
          vin: vData.vin,
          make: vData.make,
          model: vData.model,
          year: vData.year,
          bodyType: vData.bodyType,
          color: vData.color,
          fuelType: vData.fuelType,
          transmission: vData.transmission,
          engineSize: vData.engineSize,
          horsepower: vData.horsepower,
          doors: vData.doors,
          seats: vData.seats,
          driveType: vData.driveType,
          currentMileage: vData.currentMileage,
          mileageUnit: vData.mileageUnit,
          mileageHistory: [
            {
              mileage: Math.round(vData.currentMileage * 0.4),
              recordedAt: new Date(Date.now() - 365 * 24 * 3600 * 1000),
              source: 'registration',
              note: 'Initial registration on CarChain',
            },
            {
              mileage: vData.currentMileage,
              recordedAt: new Date(),
              source: 'inspection',
              note: 'Current odometer reading',
            },
          ],
          images: [{ url: vData.imageUrl, caption: `${vData.year} ${vData.make} ${vData.model}`, isPrimary: true }],
          currentOwner: seller._id,
          ownershipHistory: [
            {
              owner: seller._id,
              ownerName: `${seller.firstName} ${seller.lastName}`,
              acquiredAt: new Date(Date.now() - 365 * 24 * 3600 * 1000),
              transferMethod: 'purchase',
            },
          ],
          registrationCountry: vData.location.country,
          passportStatus: 'verified',
        });
        console.log(`✅ Demo vehicle created: ${vehicle.displayName} (${vehicle.vin})`);

        // Create listing for this vehicle
        const listing = await Listing.create({
          vehicle: vehicle._id,
          seller: seller._id,
          title: vData.title,
          description: vData.description,
          price: vData.price,
          currency: vData.currency,
          location: vData.location,
          status: 'active',
          isFeatured: true,
        });

        vehicle.activeListing = listing._id;
        await vehicle.save();
        console.log(`   └─ Active listing created: $${vData.price.toLocaleString()}`);

        // Add maintenance record for BMW
        if (vData.make === 'BMW') {
          await MaintenanceRecord.create({
            vehicle: vehicle._id,
            garage: garage._id,
            serviceType: 'oil_change',
            serviceDate: new Date(Date.now() - 60 * 24 * 3600 * 1000),
            mileageAtService: 24500,
            description:
              'Full synthetic oil change with OEM BMW TwinPower Turbo 0W-30. Replaced oil filter, microfilter and cabin air filters. Multi-point inspection completed.',
            totalCost: 320,
            currency: 'USD',
            isVerified: true,
          });

          await InspectionCertificate.create({
            vehicle: vehicle._id,
            inspector: inspector._id,
            inspectionType: 'pre_sale',
            inspectionDate: new Date(Date.now() - 30 * 24 * 3600 * 1000),
            mileageAtInspection: 27100,
            result: 'pass',
            comments: 'Vehicle in excellent mechanical and aesthetic condition. Brakes at 85%, tires at 7mm tread.',
            isVerified: true,
          });
          console.log(`   └─ Certified maintenance and inspection records attached`);
        }
      }
    }

    console.log('\n🎉 Seed completed successfully!');
    console.log('\nTest accounts:');
    console.log('  Admin:     admin@carchain.dev     / Admin123!');
    console.log('  Buyer:     buyer@carchain.dev     / Buyer123!');
    console.log('  Seller:    seller@carchain.dev    / Seller123!');
    console.log('  Garage:    garage@carchain.dev    / Garage123! (Approved)');
    console.log('  Inspector: inspector@carchain.dev / Inspector123! (Approved)');

  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB.');
  }
}

seed();
