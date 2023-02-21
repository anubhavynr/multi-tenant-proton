import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';


import input from "../proton-inputs.json";

export class PipelineInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);
    
    const aws_account_id = props?.env?.account
    const service = input.service;
    const service_instances = input.service_instances;
    const pipeline_inputs = input.pipeline.inputs
    
    const ecr_repo = new ecr.Repository(this, "myservice_repo", {
      repositoryName: "myservice_repo"
    });
    
    const artifactsBucket = new s3.Bucket(this, "ArtifactsBucket", {
          encryption: s3.BucketEncryption.S3_MANAGED,
      });
      
    // Pipeline creation starts
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: service.name + 'Pipeline',
      artifactBucket: artifactsBucket
    });
     
    
    // Declare source code as an artifact
    const sourceOutput = new codepipeline.Artifact('SourceArtifact');

    // Add source stage to pipeline
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.CodeStarConnectionsSourceAction({
          actionName: 'CodeStarSource',
          owner: service.repository_id.split("/")[0],
          repo: service.repository_id.split("/")[1],
          output: sourceOutput,
          connectionArn: service.repository_connection_arn,
          branch: service.branch_name
        }),
      ],
    });
    
    
    //Build stage
    const buildOutput = new codepipeline.Artifact('BuildArtifact');
    
    //Declare a new CodeBuild project
    const buildProject = new codebuild.PipelineProject(this, 'Build', {
      buildSpec : codebuild.BuildSpec.fromSourceFilename("your-business-microservice/buildspec.yml"),
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_3,
        privileged: true
        
      },
      environmentVariables: {
        'PACKAGE_BUCKET': {
          value: artifactsBucket.bucketName
        },
        'aws_account_id': {
          value: aws_account_id
        },
        'repo_name': {
          value: 'myservice_repo'
        },
        'service_name': {
          value: service.name
        },
        'dockerfile': {
          value: pipeline_inputs.dockerfile
        }
        
      }
    });
    
    buildProject.addToRolePolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: [
        'ecr:*',
      ],
    }));

    buildProject.addToRolePolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: [
        'proton:GetService',
      ],
    }));
    
    // Add the build stage to our pipeline
    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Build-Service',
          project: buildProject,
          input: sourceOutput,
          outputs: [buildOutput],
        }),
      ],
    });
    
    const startState = new stepfunctions.Pass(this, 'StartState');
    const simpleStateMachine  = new stepfunctions.StateMachine(this, 'SimpleStateMachine', {
      definition: startState,
    });
    
    const stepFunctionAction = new codepipeline_actions.StepFunctionInvokeAction({
      actionName: 'InvokeStepFunc',
      stateMachine: simpleStateMachine,
      stateMachineInput: codepipeline_actions.StateMachineInput.filePath(buildOutput.atPath('your-business-microservice/service.yaml'))
        
    });
    
    pipeline.addStage({
      stageName: 'InvokeStepFunctions',
      actions: [stepFunctionAction],
    });

  }
}
