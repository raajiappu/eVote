/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
*/

'use strict';

// Fabric smart contract classes
const { Contract, Context } = require('fabric-contract-api');

// PaperNet specifc classes
const Ballot = require('./ballot.js');
const BallotList = require('./ballotlist.js');
const QueryUtils = require('./queries.js');

/**
 * A custom context provides easy access to list of all ballots
 */
class BallotContext extends Context {

    constructor() {
        super();
        // All ballots are held in a list of ballots
        this.ballotList = new BallotList(this);
    }

}

/**
 * Define ballot smart contract by extending Fabric Contract class
 *
 */
class BallotContract extends Contract {

    constructor() {
        // Unique namespace when multiple contracts per chaincode file
        super('org.evote.ballot');
    }

    /**
     * Define a custom context for ballot
    */
    createContext() {
        return new BallotContext();
    }

    /**
     * Instantiate to perform any setup of the ledger that might be required.
     * @param {Context} ctx the transaction context
     */
    async instantiate(ctx) {
        // No implementation required with this example
        // It could be where data migration is performed, if necessary
        console.log('Instantiate the contract');
    }

    /**
     * Issue ballot
     *
     * @param {Context} ctx the transaction context
     * @param {String} voter 
     * @param {Integer} ballotNumber ballot number for this voter
     * @param {String} issueDateTime paper issue date
     * @param {Integer} electionNumber election number for this vote
     * @param {String} electionDateTime election date
    */
    async issue(ctx, voter, ballotNumber, issueDateTime,electionNumber, electionDateTime) {

        // create an instance of the ballot
        let ballot = Ballot.createInstance(voter, ballotNumber, issueDateTime,electionNumber, electionDateTime);

        // Smart contract, rather than ballot, moves it into ISSUED state
        ballot.setIssued();

        // save the voter's MSP 
        let mspid = ctx.clientIdentity.getMSPID();
        ballot.setVoterMSP(mspid);

        // Newly issued ballot is owned by the voter to begin with (recorded for reporting purposes)DO WE REALLY NEED THIS??? 
       // ballot.setOwner(voter);

        // Add the ballot to the list of all similar ballots in the ledger world state
        await ctx.ballotList.addBallot(ballot);

        // Must return a serialized ballot to caller of smart contract
        return ballot;
    }

    /**
     * cast vote/ballot
     
      * @param {Context} ctx the transaction context
      * @param {String} voter 
      * @param {Integer} ballotNumber ballot number for this voter
      * @param {String} issueDateTime paper issue date
      * @param {Integer} electionNumber election number for this vote
      * @param {String} selCandidate selected candidate in vote
      * @param {String} castedDateTime time ballot was casted  // transaction input - not written to asset
     */
    async cast(ctx, voter, ballotNumber,issueDateTime,electionNumber,selCandidate,castedDateTime) {

        // Retrieve the current ballot using key fields provided
        let ballotKey = Ballot.makeKey([electionNumber, ballotNumber]);
        let ballot = await ctx.ballotList.getBallot(ballotKey);

        // Validate voter
        if (ballot.getVoter() !== voter) {
            throw new Error('\nballot ' + voter + ballotNumber + 'not matched ');
        }
       else 
          {
            if(getSelCandidate() !== undefined){
                throw new Error('\nballot ' + voter + ballotNumber + 'already casted ');       
             }
            }
        // Casting vote moves state from ISSUED to TALLY 
        if (ballot.isIssued()) {
            

            ballot.setTally();
        }

        // Check paper is not already tallied
       if (ballot.isTally()) {
         ballot.setSelCandidate(selCandidate);
            // save the voter's MSP 
          let mspid = ctx.clientIdentity.getMSPID();
          ballot.setvoterMSP(mspid);
     } else {
          throw new Error('\nballot ' + voter + ballotNumber + ' is not tallied. Current state = ' + ballot.getCurrentState());
        }

        // Update the ballot
        await ctx.ballotList.updateBallot(ballot);
        return ballot;
    }

    /**
      *  cast request:  (2-phase confirmation: ballot is 'PENDING' subject to completion of voting )
      *  Alternative to 'cast' transaction
      *  Note: 'cast_request' puts ballot in 'PENDING' state - subject to vote confirmation [below].
      * * @param {Context} ctx the transaction context
      * @param {String} voter 
      * @param {Integer} ballotNumber ballot number for this voter
      * @param {String} issueDateTime paper issue date
      * @param {Integer} electionNumber election number for this vote
      * @param {String} selCandidate selected candidate in vote// transaction input - not written to asset per se - but written to block
      * @param {String} castedDateTime time ballot was casted // transaction input - not written to asset per se - but written to block
     */
    async cast_request(ctx, voter, ballotNumber, issueDateTime,electionNumber,selCandidate,castedDateTime) {
        

        // Retrieve the current ballot using key fields provided
        let ballotKey = Ballot.makeKey([electionNumber, ballotNumber]);
        let ballot = await ctx.ballotList.getBallot(ballotKey);

         // Validate voter- this is really information for the user trying the sample, rather than any 'authorisation' check per se FYI
      
        if (ballot.getVoter() !== voter) {
            throw new Error('\nballot ' + voter + ballotNumber + 'not matched ');
        }
       else 
          {
            if(getSelCandidate() !== undefined){
                throw new Error('\nballot ' + voter + ballotNumber + 'already casted ');       
             }
            }
        // ballot set to 'PENDING' - can only be transferred (confirmed) by identity from owning org (MSP check).
        ballot.setPending();

        // Update the paper
        await ctx.ballotList.updateBallot(ballot);
        return ballot;
    }

    /**
     * tallied ballot: only the owning org has authority to execute. It is the complement to the 'cast_request' transaction. '[]' is optional below.
     * eg. issue -> cast_request -> tallied -> verify
     * this transaction 'pair' is an alternative to the straight issue -> cast -> verify ...path
     *
     * @param {Context} ctx the transaction context
     * @param {String} voter 
     * @param {Integer} ballotNumber ballot number for this voter
     * @param {String} selCandidate 
     * @param {Integer} electionNumber election number for this vote
     * @param {String} confirmDateTime  confirmed voting date.
    */
    async tallied(ctx, voter, ballotNumber, selCandidate, electionNumber, confirmDateTime) {

        // Retrieve the current ballot using key fields provided
        let ballotKey = Ballot.makeKey([electionNumber, ballotNumber]);
        let ballot = await ctx.ballotList.getBallot(ballotKey);

        // Validate current owner's MSP in the paper === invoking transferor's MSP id - can only transfer if you are the owning org.

       if (ballot.getVoterMSP() !== ctx.clientIdentity.getMSPID()) {
      throw new Error('\nBallot ' + voter + ballotNumber + 'not authorised to vote');
       }
        // ballot needs to be 'pending' - which means you need to have run 'cast_pending' transaction first.
        if ( ! ballot.isPending()) {
            throw new Error('\nBallot ' + voter + ballotNumber + ' is not currently in state: PENDING for tally to occur: \n must run cast_request transaction first');
        }
        // else all good

        ballot.setSelCandidate(selCandidate);
        // set the MSP of the voter(so that, that org may also pass MSP check)
       // ballot.setVoterMSP(newOwnerMSP);
       ballot.setTally();
        ballot.confirmDateTime = confirmDateTime;

        // Update the ballot
        await ctx.ballotList.updateBallot(ballot);
        return ballot;
    }

    /**
     * audit ballot
     *
     * @param {Context} ctx the transaction context
     * @param {String} voter 
     * @param {Integer} ballotNumber 
     * @param {Integer} electionNumber election number for this vote
     * @param {String} verifier  of paper
     * @param {String} verifyDateTime time paper was verified
    */
    async audit(ctx, voter, ballotNumber, electionNumber,verifier, verifierMSP, verifyDateTime) {

        let ballotKey = Ballot.makeKey([electionNumber, ballotNumber]);

        let ballot = await ctx.ballotList.getBallot(ballotKey);


        // Validate current redeemer's MSP matches the invoking redeemer's MSP id - can only redeem if you are the owning org.

      if (ballot.isIssued() || ballot.isPending()) {
          throw new Error('\nPaper ' + electionNumber+ ballotNumber + ' cannot be verified by ' + verifier + ', as it is not tallied');
       }

        // voter verification check
      if (ballot.getVoter() === voter) {
         ballot.setOwner(verifier);
         
         ballot.setVerified();
         ballot.verifyDateTime = verifyDateTime; // record verified date against the asset (the complement to 'issue date')
       } else {
         throw new Error('\nVerifing org: ' + verifier + ' says ballot voter' + voter + ballotNumber+'mismatch');
       }

        await ctx.ballotList.updateBallot(ballot);
        return ballot;
    }

    // Query transactions

    /**
     * Query history of a Ballot
     * @param {Context} ctx the transaction context
     * @param {Integer} electionNumber election number for this vote
     * @param {Integer} ballotNumber Ballot number for this voter
    */
    async queryHistory(ctx, electionNumber, ballotNumber) {

        // Get a key to be used for History query

        let query = new QueryUtils(ctx, 'org.evote.ballot');
        let results = await query.getAssetHistory(electionNumber, ballotNumber); // (cpKey);
        return results;

    }

    /**
    * query ballot: supply number of election, to find list of ballots based on electionNumber field
    * @param {Context} ctx the transaction context
    * @param {Integer} electionNumber election number for this vote
    */
    async queryElection(ctx, electionNumber) {

        let query = new QueryUtils(ctx, 'org.evote.ballot');
        let electionnumber_results = await query.queryKeyByelectionNumber(electionNumber);

        return electionnumber_results;
    }

    /**
    * queryPartial ballot - provide a prefix eg. "Organiser" will list all papers _issued_ by organiser etc etc
    * @param {Context} ctx the transaction context
    * @param {String} prefix asset class prefix (added to ballotlist namespace) eg. org.evote.ballotVerifier asset listing: ballots issued by verifier.
    */
    async queryPartial(ctx, prefix) {

        let query = new QueryUtils(ctx, 'org.evote.ballot');
        let partial_results = await query.queryKeyByPartial(prefix);

        return partial_results;
    }

    /**
    * queryAdHoc ballot - supply a custom mango query
    * eg - as supplied as a param:     
    * ex1:  ["{\"selector\":{\"selCandidate\":{\"$lt\":8000000}}}"]
    * ex2:  ["{\"selector\":{\"selCandidate\":{\"$gt\":4999999}}}"]
    * 
    * @param {Context} ctx the transaction context
    * @param {String} queryString querystring
    */
    async queryAdhoc(ctx, queryString) {

        let query = new QueryUtils(ctx, 'org.evote.ballot');
        let querySelector = JSON.parse(queryString);
        let adhoc_results = await query.queryByAdhoc(querySelector);

        return adhoc_results;
    }


    /**
     * queryNamed - supply named query - 'case' statement chooses selector to build (pre-canned for demo purposes)
     * @param {Context} ctx the transaction context
     * @param {String} queryname the 'named' query (built here) - or - the adHoc query string, provided as a parameter
     */
    async queryNamed(ctx, queryname) {
        let querySelector = {};
        switch (queryname) {
            case "verified":
                querySelector = { "selector": { "currentState": 4 } };  // 4 = verified state
                break;
            case "tally":
                querySelector = { "selector": { "currentState": 3 } };  // 3 = tally state
                break;
           // case "selection":
                // may change to provide as a param - fixed value for now in this sample
            //    querySelector = { "selector": { "selCandidate": { "$gt": 4000000 } } };  // to test, issue CommPapers with faceValue <= or => this figure.
              //  break;
            default: // else, unknown named query
                throw new Error('invalid named query supplied: ' + queryname + '- please try again ');
        }

        let query = new QueryUtils(ctx, 'org.evote.ballot');
        let adhoc_results = await query.queryByAdhoc(querySelector);

        return adhoc_results;
    }

}

module.exports = BallotContract;
