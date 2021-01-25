/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
*/

'use strict';

// Utility class for collections of ledger states --  a state list
const StateList = require('./../ledger-api/statelist.js');

const Ballot = require('./ballot.js');

class BallotList extends StateList {

    constructor(ctx) {
        super(ctx, 'org.evote.ballot');
        this.use(Ballot);
    }

    async addBallot(ballot) {
        return this.addState(ballot);
    }

    async getBallot(ballotKey) {
        return this.getState(ballotKey);
    }

    async updateBallot(ballot) {
        return this.updateState(ballot);
    }
}


module.exports = BallotList;
