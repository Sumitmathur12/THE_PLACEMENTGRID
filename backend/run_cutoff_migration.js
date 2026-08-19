import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const runMigration = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found in env!');
    process.exit(1);
  }

  console.log('Connecting to database...');
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('Database Connected.');

    const CompanyCol = mongoose.connection.collection('companies');
    const RoleProfileCol = mongoose.connection.collection('roleprofiles');
    const RoadmapCol = mongoose.connection.collection('roadmaps');

    // 1. Update verified cutoffs (Accenture, Infosys, TCS, Intuit)
    console.log('\n--- 1. Updating verified company cutoffs ---');
    const verifiedUpdates = [
      { name: 'Accenture', cutoff: 6.5 },
      { name: 'Infosys', cutoff: 6.0 },
      { name: 'TCS', cutoff: 6.0 },
      { name: 'Intuit', cutoff: 7.0 }
    ];

    for (const update of verifiedUpdates) {
      // Use case-insensitive RegExp to find the company
      const res = await CompanyCol.updateMany(
        { name: new RegExp(`^${update.name}$`, 'i') },
        { $set: { collegeCutoff: update.cutoff, lastUpdated: new Date() } }
      );
      console.log(`Updated ${res.modifiedCount} matches for "${update.name}" to cutoff ${update.cutoff}`);
    }

    // 2. Perform Case-Insensitive Deduplication & Merge
    console.log('\n--- 2. Cleaning up case-insensitive duplicates ---');
    const allCompanies = await CompanyCol.find({}).toArray();
    const groups = {};

    for (const c of allCompanies) {
      const baseName = c.name.split('_')[0].trim();
      const baseKey = baseName.toLowerCase();
      if (!groups[baseKey]) {
        groups[baseKey] = [];
      }
      groups[baseKey].push({ doc: c, baseName });
    }

    let mergedCount = 0;
    for (const key of Object.keys(groups)) {
      const items = groups[key];
      if (items.length <= 1) continue;

      console.log(`Found duplicate group for: "${items[0].baseName}" (${items.length} records)`);

      // Determine survivor: prefer one with clean name (no underscore), or highest verified, or oldest
      let survivorIdx = 0;
      for (let i = 0; i < items.length; i++) {
        const name = items[i].doc.name;
        if (!name.includes('_')) {
          survivorIdx = i;
          break;
        }
      }

      const survivorItem = items[survivorIdx];
      const survivor = survivorItem.doc;
      const cleanName = survivorItem.baseName;

      // Update survivor's name to the clean base name
      await CompanyCol.updateOne({ _id: survivor._id }, { $set: { name: cleanName } });
      console.log(`  Survivor selected: "${cleanName}" (ID: ${survivor._id})`);

      for (let i = 0; i < items.length; i++) {
        if (i === survivorIdx) continue;
        const duplicate = items[i].doc;
        console.log(`  Merging duplicate stub: "${duplicate.name}" (ID: ${duplicate._id})`);

        // Migrate RoleProfiles
        const rpRes = await RoleProfileCol.updateMany(
          { companyId: duplicate._id },
          { $set: { companyId: survivor._id } }
        );
        if (rpRes.modifiedCount > 0) {
          console.log(`    Migrated ${rpRes.modifiedCount} RoleProfiles.`);
        }

        // Migrate Roadmaps
        const rmRes = await RoadmapCol.updateMany(
          { companyId: duplicate._id },
          { $set: { companyId: survivor._id } }
        );
        if (rmRes.modifiedCount > 0) {
          console.log(`    Migrated ${rmRes.modifiedCount} Roadmaps.`);
        }

        // Delete duplicate company stub
        await CompanyCol.deleteOne({ _id: duplicate._id });
        mergedCount++;
      }
    }
    console.log(`Duplicate cleanup complete. Merged/Deleted ${mergedCount} stubs.`);

    // 3. Apply Smarter Safety-Net Reset
    console.log('\n--- 3. Running smarter safety-net reset ---');
    const cutoffMigration = await CompanyCol.updateMany(
      {
        collegeCutoff: { $in: [60, 6.0, '60', '6.0', 6, '6'] },
        name: { $nin: ['TCS', 'Infosys'] }
      },
      { $set: { collegeCutoff: 'Not available' } }
    );
    console.log(`Reset ${cutoffMigration.modifiedCount} suspicious 60/6.0 cutoffs to 'Not available' (excluding TCS & Infosys).`);

    console.log('\nMigration run completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
};

runMigration();
