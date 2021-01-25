/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
*/

'use strict';

// Utility class for ledger state
const State = require('./../ledger-api/state.js');

// Enumerate ballot state values
const btState = {
    ISSUED: 1,
    PENDING: 2,
    TALLY: 3,
    VERIFY: 4
};

/**
 * Ballot class extends State class
 * Class will be used by application and smart contract to define a ballot
 */
class Ballot extends State {

    constructor(obj) {
        super(Ballot.getClass(), [obj.electionNumber, obj.ballotNumber]);
        Object.assign(this, obj);
    }

    /**
     * Basic getters and setters
    */
    getVoter() {
        return this.voter;
    }

    setVoter(newVoter) {
        this.voter = newVoter;
    }

    getSelCandidate() {
        return this.selCandidate;
    }

    setVoterMSP(mspid) {
        this.mspid = mspid;
    }

    getVoterMSP() {
        return this.mspid;
    }

    setSelCandidate(newSelCandidate) {
        this.SelCandidate = newSelCandidate;
    }
    setOwner(newOwner){
  this.owner=newOwner;
}

getOwner(){
return this.owner;
}
    /**
     * Useful methods to encapsulate ballot states
     */
    setIssued() {
        this.currentState = btState.ISSUED;
    }

    setTally() {
        this.currentState = btState.TALLY;
    }

    setVerify() {
        this.currentState = btState.VERIFIED;
    }

    setPending() {
        this.currentState = btState.PENDING;
    }

    isIssued() {
        return this.currentState === btState.ISSUED;
    }

    isTally() {
        return this.currentState === btState.TALLY;
    }

    isVerified() {
        return this.currentState === btState.VERIFIED;
    }

    isPending() {
        return this.currentState === btState.PENDING;
    }

    static fromBuffer(buffer) {
        return Ballot.deserialize(buffer);
    }

    toBuffer() {
        return Buffer.from(JSON.stringify(this));
    }

    /**
     * Deserialize a state data to ballot
     * @param {Buffer} data to form back into the object
     */
    static deserialize(data) {
        return State.deserializeClass(data, Ballot);
    }

    /**
     * Factory method to create a ballot object
     */
    static createInstance(voter, ballotNumber, issueDateTime, electionNumber,electionDateTime) {
        return new Ballot({ voter, ballotNumber, issueDateTime, electionNumber,electionDateTime });
    }

    static getClass() {
        return 'org.evote.ballot';
    }
}

module.exports = Ballot;
