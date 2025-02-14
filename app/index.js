const { google } = require('googleapis');
const knex = require('knex');
const knexConfig = require('../knexfile.js');
const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const db = knex(knexConfig);

db.raw('SELECT 1')
  .then(() => {
    console.log('Database connected');
  })
  .catch(err => {
    console.error('Database connection failed:', err);
  });

db.migrate.latest()
  .then(() => {
    console.log('Migrations ran successfully');
  })
  .catch(err => {
    console.error('Error running migrations:', err);
  });

/**
 * @async
 * @function fetchDataAndInsert
 * @returns {Promise<void>} 
*/
async function fetchDataAndInsert() {
  try {
    const response = await axios.get('https://common-api.wildberries.ru/api/v1/tariffs/box');
    const data = response.data;
    const fetchDate = new Date().toISOString().split('T')[0];

    const [tariffId] = await db('tariffs').insert({
      dtNextBox: data.dtNextBox,
      dtTillMax: data.dtTillMax
    }).returning('id');

    for (const warehouse of data.warehouseList) {
      const [warehouseId] = await db('warehouses').insert({
        name: warehouse.warehouseName,
      }).returning('id');

      await db('tariff_warehouse').insert({
        fetchDate: fetchDate,
        boxDeliveryAndStorageExpr: warehouse.boxDeliveryAndStorageExpr,
        boxDeliveryBase: warehouse.boxDeliveryBase,
        boxDeliveryLiter: warehouse.boxDeliveryLiter,
        boxStorageBase: warehouse.boxStorageBase,
        boxStorageLiter: warehouse.boxStorageLiter,
        tariff_id: tariffId,
        warehouse_id: warehouseId
      })
      .onConflict(['tariff_id', 'warehouse_id', 'fetchDate'])
      .merge({
        boxDeliveryAndStorageExpr: warehouse.boxDeliveryAndStorageExpr,
        boxDeliveryBase: warehouse.boxDeliveryBase,
        boxDeliveryLiter: warehouse.boxDeliveryLiter,
        boxStorageBase: warehouse.boxStorageBase,
        boxStorageLiter: warehouse.boxStorageLiter
      });
    }

    console.log('Data inserted successfully');
  } catch (error) {
    console.error('Error fetching or inserting data:', error);
  }
}

/**
 * @async
 * @function authorize
 * @returns {Promise<object>}
 */
async function authorize() {
  const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  const { client_email, private_key } = credentials;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email,
      private_key,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const authClient = await auth.getClient();
  return authClient;
}

/**
 * @async
 * @function writeToSheets
 * @param {object} auth
 * @param {Array<Array<string|number>>} data
 * @returns {Promise<void>}
 */
async function writeToSheets(auth, data) {
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const range = 'Sheet1!A1';

  const resource = {
    values: data,
  };

  sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    resource,
  }, (err, result) => {
    if (err) {
      console.error('Error writing to Google Sheets:', err);
    } else {
      console.log(`${result.data.updatedCells} cells updated.`);
    }
  });
}

/**
 * Loads data from the database and writes it to Google Sheets.
 * @async
 * @function loadData
 * @returns {Promise<void>} 
 */
async function loadData() {
  try {
    const auth = await authorize();
    const data = await db('tariff_warehouse')
      .join('tariffs', 'tariffs.id', 'tariff_warehouse.tariff_id')
      .join('warehouses', 'warehouses.id', 'tariff_warehouse.warehouse_id')
      .select('tariffs.dtNextBox', 'tariffs.dtTillMax', 'warehouses.name', 'tariff_warehouse.*');
    const formattedData = data.map(row => Object.values(row));
    await writeToSheets(auth, formattedData);
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

fetchDataAndInsert();
loadData();

cron.schedule('0 * * * *', fetchDataAndInsert);
cron.schedule('1 0 * * *', loadData);
  
  
