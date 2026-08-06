import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

export const LINKS_TABLE = process.env.LINKS_TABLE
export const ACCOUNTS_TABLE = process.env.ACCOUNTS_TABLE

export const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }))