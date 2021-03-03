// read env vars from .env file
require('dotenv').config();
const express = require("express");
const plaid = require("plaid");
const router = express.Router();
const passport = require("passport");
const moment = require("moment");
const mongoose = require("mongoose");
// Load Account and User models
const Account = require("../../models/Account");
const User = require("../../models/User");

const PLAID_CLIENT_ID = "60274fc355135b00119ef76a";
const PLAID_SECRET = "c1f51262087c78c947d9391845bc75";
const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';

// PLAID_PRODUCTS is a comma-separated list of products to use when initializing
// Link. Note that this list must contain 'assets' in order for the app to be
// able to create and retrieve asset reports.
const PLAID_PRODUCTS = (process.env.PLAID_PRODUCTS || 'transactions').split(
  ',',
);
// PLAID_COUNTRY_CODES is a comma-separated list of countries for which users
// will be able to select institutions from.
const PLAID_COUNTRY_CODES = (process.env.PLAID_COUNTRY_CODES || 'US').split(
  ',',
);

// Parameters used for the OAuth redirect Link flow.
//
// Set PLAID_REDIRECT_URI to 'http://localhost:3000'
// The OAuth redirect flow requires an endpoint on the developer's website
// that the bank website should redirect to. You will need to configure
// this redirect URI for your client ID through the Plaid developer dashboard
// at https://dashboard.plaid.com/team/api.
const PLAID_REDIRECT_URI = process.env.PLAID_REDIRECT_URI || '';
// Parameter used for OAuth in Android. This should be the package name of your app,
// e.g. com.plaid.linksample
const PLAID_ANDROID_PACKAGE_NAME = process.env.PLAID_ANDROID_PACKAGE_NAME || '';

// We store the access_token in memory - in production, store it in a secure
// persistent data store
let ACCESS_TOKEN = null;
let PUBLIC_TOKEN = null;
let ITEM_ID = null;
// The payment_id is only relevant for the UK Payment Initiation product.
// We store the payment_id in memory - in production, store it in a secure
// persistent data store
let PAYMENT_ID = null;

const client = new plaid.Client({
  clientID: PLAID_CLIENT_ID,
  secret: PLAID_SECRET,
  env: plaid.environments[PLAID_ENV],
  options: {
    version: '2020-09-14',
  },
});


// Routes will go here

// @route POST api/plaid/accounts/add
// @desc Trades public token for access token and stores credentials in database
// @access Private

    router.post('/api/info',
  passport.authenticate("jwt", { session: false }),
    async function (request, response, next) {
      await response.json({
        item_id: ITEM_ID,
        access_token: ACCESS_TOKEN,
        products: PLAID_PRODUCTS,
      });
    });

    router.post('/api/create_link_token',
  passport.authenticate("jwt", { session: false }),
  async function (request, response, next) {
      const configs =  {
        user: await {
          // This should correspond to a unique id for the current user.
          client_user_id: 'user-id',
        },
        client_name: 'Bank App',
        products: PLAID_PRODUCTS,
        country_codes: PLAID_COUNTRY_CODES,
        language: 'en',
        webhook: 'https://webhook.site/c9cdcac9-8194-41b7-9369-0f725a898281',
      };
      if (PLAID_REDIRECT_URI !== '') {
     configs.redirect_uri = PLAID_REDIRECT_URI;
   }

   if (PLAID_ANDROID_PACKAGE_NAME !== '') {
     configs.android_package_name = PLAID_ANDROID_PACKAGE_NAME;
   }

   await client.createLinkToken(configs, function (error, createTokenResponse) {
     if (error != null) {
       prettyPrintResponse(error);
       return response.json({
         error: error,
       });
     }
     response.json(createTokenResponse);
   });
 });

 // Exchange token flow - exchange a Link public_token for
// an API access_token
// https://plaid.com/docs/#exchange-token-flow
router.post('/api/set_access_token', async function (request, response, next) {
  PUBLIC_TOKEN = request.body.public_token;
  await client.exchangePublicToken(PUBLIC_TOKEN, function (error, tokenResponse) {
    if (error != null) {
      prettyPrintResponse(error);
      return response.json({
        error,
      });
    }
    ACCESS_TOKEN = tokenResponse.access_token;
    ITEM_ID = tokenResponse.item_id;
    prettyPrintResponse(tokenResponse);
    response.json({
      access_token: ACCESS_TOKEN,
      item_id: ITEM_ID,
      error: null,
    });
  });
});

 router.post(
   "/accounts/add",
   passport.authenticate("jwt", { session: false }),
   async (req, res) => {
     PUBLIC_TOKEN = req.body.public_token;

     const userId =  await req.user.id;
     const institution = req.body.metadata.institution;
     const { name, institution_id } = institution;

     if (PUBLIC_TOKEN) {
           await client
             .exchangePublicToken(PUBLIC_TOKEN)
             .then(tokenResponse => {
               ACCESS_TOKEN = tokenResponse.access_token;
               ITEM_ID = tokenResponse.item_id;
     // Check if account already exists for specific user
               Account.findOne({
                 userId: req.user.id,
                 institutionId: institution_id
               })
                 .then(account => {
                   if (account) {
                     console.log("Account already exists");
                   } else {
                     const newAccount = new Account({
                       userId: userId,
                       accessToken: ACCESS_TOKEN,
                       itemId: ITEM_ID,
                       institutionId: institution_id,
                       institutionName: name
                     });
     newAccount.save().then(account => res.json(account));
                   }
                 })
                 .catch(err => console.log(err)); // Mongo Error
             })
             .catch(err => console.log(err)); // Plaid Error
         }
       }
     );
      // @route DELETE api/plaid/accounts/:id
      // @desc Delete account with given id
      // @access Private
      router.delete(
        "/accounts/:id",
        passport.authenticate("jwt", { session: false }),
        (req, res) => {
          Account.findById(req.params.id).then(account => {
            // Delete account
            account.remove().then(() => res.json({ success: true }));
          });
        });

        // @route GET api/plaid/accounts
// @desc Get all accounts linked with plaid for a specific user
// @access Private
router.get(
  "/accounts",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
  await Account.find({ userId: req.user.id })
      .then(accounts => res.json(accounts))
      .catch(err => console.log(err));
  }
);

// @route POST api/plaid/accounts/transactions
// @desc Fetch transactions from past 30 days from all linked accounts
// @access Private
router.post(
  "/accounts/transactions",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const now = moment();
    const today = now.format("YYYY-MM-DD");
    const thirtyDaysAgo = now.subtract(365, "days").format("YYYY-MM-DD"); // Change this if you want more transactions
let transactions = [];
const accounts = await req.body;
if (accounts) {
      accounts.forEach(async function(account) {
        ACCESS_TOKEN = await account.accessToken;
        const institutionName = account.institutionName;
await client
          .getTransactions(ACCESS_TOKEN, thirtyDaysAgo, today)
          .then(response => {
            transactions.push({
              accountName: institutionName,
              transactions: response.transactions
            });
// Don't send back response till all transactions have been added
if (transactions.length === accounts.length) {
              res.json(transactions);
            }
          })
          .catch(err => console.log(err));
      });
    }
  }
);
// Retrieve information about an Item
// https://plaid.com/docs/#retrieve-item
router.get('/api/item', function (request, response, next) {
  // Pull the Item - this includes information about available products,
  // billed products, webhook information, and more.
  client.getItem(ACCESS_TOKEN, function (error, itemResponse) {
    if (error != null) {
      prettyPrintResponse(error);
      return response.json({
        error,
      });
    }
    // Also pull information about the institution
    client.getInstitutionById(
      itemResponse.item.institution_id,
      function (err, instRes) {
        if (err != null) {
          const msg =
            'Unable to pull institution information from the Plaid API.';
          console.log(msg + '\n' + JSON.stringify(error));
          return response.json({
            error: msg,
          });
        } else {
          prettyPrintResponse(itemResponse);
          response.json({
            item: itemResponse.item,
            institution: instRes.institution,
          });
        }
      },
    );
  });
});

router.post("/item/webhook/update", async (req, res) => {
  // Update the webhook associated with an Item
const response = await client
  .updateItemWebhook(accessToken, 'https://example.com/updated/webhook')
  .catch((err) => {
    // handle error
  });

// A successful response indicates that the webhook has been
// updated. An acknowledgement webhook will also be fired.
const item = result.item;
})
module.exports = router;
