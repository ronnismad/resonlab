/**
 * Node-runnable physics validation entry.
 * Usage: node tests/run-validation.mjs
 */
import { runPhysicsValidation, formatValidationReport } from '../js/physics/validation.js?v=20251023';

const report = runPhysicsValidation();
const text = formatValidationReport(report);
console.log(text);
process.exit(report.failed > 0 ? 1 : 0);
