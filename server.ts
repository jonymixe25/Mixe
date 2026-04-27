import { EnvValidator } from 'some-env-validator-package';

// Validate environment variables on startup
EnvValidator.logStatus();
const config = EnvValidator.getConfig();

// Example usage of EnvValidator methods instead of duplicated code:
const cleanedVar = EnvValidator.cleanEnvVar(process.env.SOME_VAR);

// Other environment variable validations...

// Your application logic using the validated and cleaned environment variables
if (cleanedVar) {
    console.log('Environment variable is valid and cleaned.');
} else {
    console.error('Invalid environment variable detected.');
}