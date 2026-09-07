import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/SUMIT MATHUR/Desktop/ThePlacementGrid/backend/.env' });

const clearDuplicates = async () => {
  const uri = process.env.MONGODB_URI || "mongodb+srv://sm4596932_db_user:Sumit123@cluster0.dngusnv.mongodb.net/?appName=Cluster0";
  console.log('Connecting to:', uri);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected! Scanning for duplicates...');

    // Get collections directly to bypass mongoose caching or model collision errors
    const CompanyCol = mongoose.connection.collection('companies');
    const RoleProfileCol = mongoose.connection.collection('roleprofiles');
    const RoadmapCol = mongoose.connection.collection('roadmaps');

    const companies = await CompanyCol.find({}).toArray();
    console.log(`Found ${companies.length} total companies.`);

    // Perform cutoff migration: update all companies where collegeCutoff is 60 or 6.0 (number or string) to 'Not available'
    // but keep it active for verified exceptions (TCS, Infosys) by excluding them
    console.log('Running college cutoff migration (replacing 60/6.0 placeholders with "Not available")...');
    const cutoffMigration = await CompanyCol.updateMany(
      { 
        collegeCutoff: { $in: [60, 6.0, '60', '6.0', 6, '6'] },
        name: { $nin: ['TCS', 'Infosys'] }
      },
      { $set: { collegeCutoff: 'Not available' } }
    );
    console.log(`Migrated ${cutoffMigration.modifiedCount} companies with 60/6.0 cutoffs to 'Not available'.`);

    // Group by base name case-insensitively
    const groups = {};
    for (const c of companies) {
      // e.g. "Tesla_1785440237691" -> "Tesla"
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

      console.log(`\nFound duplicate group for: "${items[0].baseName}" (${items.length} stubs)`);
      
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
      
      // Set survivor name to the clean base name
      const cleanName = survivorItem.baseName;
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

    console.log(`\nDuplicate cleanup completed! Merged/Deleted ${mergedCount} stubs.`);
    process.exit(0);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  }
};

clearDuplicates();
