import * as Minio from 'minio'

import sqlite3 from 'sqlite3'
import CSV from "csv-parser";
import {
  PassThrough,
  Readable,
  Transform
} from 'node:stream'
import {
  pipeline
} from 'node:stream/promises'
import {
  promisify
} from 'node:util'
import { createReadStream, createWriteStream } from 'node:fs'
import { parse } from 'node:path'
import knex from 'knex'
const connection = sqlite3.verbose()
const db = new connection.Database('./data/db')
const serializeAsync = promisify(db.serialize.bind(db))
const runAsync = promisify(db.run.bind(db))
const findAllAsync = promisify(db.all.bind(db))
console.time('stream-to-bucket')

await serializeAsync()

const dbKnex = knex({
  client: 'pg',
  connection: {
    host: 'localhost',
    port: '5432',
    user: 'postgres',
    database: 'docker',
    password: 'docker',
  }
});

var minioClient = new Minio.Client({
  endPoint:  'localhost',//'play.min.io',
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin',
});

try {
    const bucketExists = await minioClient.bucketExists('james');
  
    if (!bucketExists){
      await minioClient.makeBucket('james', 'us-east-1');
    }    
  } catch (error) {
    throw new Error(error.message);
  
  }

async function* selectAsStream() {
  const defaultLimit = 100;
  let skip = 0;

  const data = dbKnex.select('*').from('users').stream();

  for await (const item of data){
    yield Buffer.from(JSON.stringify(item))     
  }
  // while (true) {
  //   const data = await findAllAsync(
  //     `SELECT * FROM users LIMIT ${defaultLimit} OFFSET ${skip}`
  //   )

    

  //   skip += defaultLimit
  //   // if we've consumed all data it's gonna stop!
  //   if (!data.length) break;
  //   for await (const item of data) yield item
  // }
}

let processed = 0

async function* transformData(chunk){
  for await (const stream of chunk){
    processed++;
    console.log(stream.toString());
    yield stream;//Buffer.from(JSON.stringify(stream).concat("\n"));
  }
}

async function uploadFromStream(chunk) {

  //for await (const chunk of stream){
    return minioClient.putObject('james',  'output', chunk, {'Content-Type': 'application/csv'});
  //}  
}
const streamMarco = selectAsStream();

try {
  
  const result =  await pipeline( streamMarco,
     transformData,
     uploadFromStream
    )
 
    console.log(result);
 } catch (error) {
   throw new Error(error.message)
 }

console.log(`\nprocess has finished with  ${processed} items...`)

console.timeEnd('stream-to-bucket')