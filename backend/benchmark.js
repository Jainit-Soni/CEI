const { getColleges } = require('./services/dataStore');

async function runBenchmark() {
    console.log("Starting Benchmark...");
    const start = performance.now();
    await getColleges(); // First run (Cold)
    const mid = performance.now();
    await getColleges(); // Second run (Warm - if any cache existed)
    const end = performance.now();

    console.log(`Cold Load: ${(mid - start).toFixed(2)}ms`);
    console.log(`Warm Load: ${(end - mid).toFixed(2)}ms`);
    process.exit(0);
}

runBenchmark();
