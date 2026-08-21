import * as cdk from 'aws-cdk-lib';
import { RemovalPolicies, Mixins } from 'aws-cdk-lib';

import { Hosting, BlocksStack, SandboxDisableDeletionProtection } from '@aws-blocks/blocks/cdk';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getStackName } from '@aws-blocks/blocks/scripts';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = new cdk.App();

const sandboxMode = app.node.tryGetContext('sandboxMode') === 'true';
const projectRoot = app.node.tryGetContext('projectRoot') || process.cwd();

const stackName = getStackName({ sandbox: sandboxMode, projectRoot });
export const blocksStack = await BlocksStack.create(app, stackName, {
  backendHandlerPath: join(__dirname, 'index.handler.ts'),
  backendCDKPath: join(__dirname, 'index.ts')
});

if (sandboxMode) {
  // Make all resources deletable so sandbox:destroy can clean up the entire stack.
  // This overrides removal policies and deletion protection (e.g. RDS) for every
  // resource in the stack, including any you add below.
  // Remove these lines if you want to manage teardown behavior yourself.
  RemovalPolicies.of(blocksStack).destroy();
  Mixins.of(blocksStack).apply(new SandboxDisableDeletionProtection());
}

// Add Next.js SSR hosting only when deploying (not in sandbox mode)
if (!sandboxMode) {
  new Hosting(blocksStack, 'Hosting', {
    root: join(__dirname, '..'),
    buildCommand: 'npm run build',
    framework: 'nextjs',
    api: blocksStack,
    compute: {
      memorySize: 1024,
      timeout: 30,
    },
    /**
     * Custom domain, active only once HOSTING_CERTIFICATE_ARN is exported.
     *
     * BYO certificate rather than letting Hosting provision one: that path
     * needs a Route 53 hosted zone, and this domain's DNS lives at Squarespace.
     * The ARN must be an ACM certificate in us-east-1 (CloudFront's
     * requirement; the construct rejects any other region) and it must cover
     * BOTH names below, because Hosting creates its own certificate for the
     * primary domain only and reuses it for the rest -- CloudFront refuses an
     * alias the attached certificate does not cover.
     *
     * With no hostedZone/hostedZoneId, no Route 53 records are created: the
     * apex is pointed with an ALIAS record at Squarespace instead, and DNSSEC
     * has to be off there for ALIAS to be accepted.
     */
    ...(process.env.HOSTING_CERTIFICATE_ARN
      ? {
          domain: {
            domainName: ['someusefullinks.com', 'www.someusefullinks.com'],
            certificate: Certificate.fromCertificateArn(
              blocksStack,
              'HostingCertificate',
              process.env.HOSTING_CERTIFICATE_ARN,
            ),
            wwwRedirect: 'toApex' as const,
          },
        }
      : {}),
  });
}
