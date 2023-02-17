#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PipelineInfrastructureStack } from '../lib/pipeline_infrastructure-stack';

const app = new cdk.App();
new PipelineInfrastructureStack(app, 'ProtonPipeline', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});