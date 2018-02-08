import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import { Tasks } from './tasks.js';

export const Scorecards = new Mongo.Collection('scorecards');

if (Meteor.isServer) {
  // This code only runs on the server
  // Only publish tasks that are public or belong to the current user
  Meteor.publish('scorecard', function tasksPublication() {
    return Scorecards.find({owner: this.userId });
  });
}

Meteor.methods({
  'scorecard.upsert'(points) {
    check(points, Number);

    // Make sure the user is logged in before inserting a task
    if (! this.userId) {
      throw new Meteor.Error('not-authorized');
    }

    //  Setup scorecard modifier
    var scorecardModifier = {};

    //  Set all insert values if this is an insert
    scorecardModifier.$setOnInsert = {
      owner: this.userId,
      status: "new"
      //points: 0
    };

    //  Set increment value for points if this is an update
    scorecardModifier.$inc = {};
    scorecardModifier.$inc['points'] = points;

    //  Query userId
    Scorecards.upsert({owner: this.userId}, scorecardModifier, function(error) {
      if(error) {
        console.log("SERVER ERROR: scorecard.upsert: Error upserting Scorecard object: " + error.message);
        throw new Meteor.Error(500, "Error upserting Scorecard object: " + (error.reason ? error.reason : error.message));
      }
    });
  },
  'scorecards.toggle'() {

    const scorecard = Scorecards.findOne({owner: this.userId});
    const userId = this.userId;

    if(scorecard) {
      if (scorecard.owner !== this.userId) {
        // make sure only the owner can delete it
        throw new Meteor.Error('not-authorized');
      }

      // Possibly do some finds in here
      var task = Tasks.findOne({ owner: userId });

      if(!task)
        throw new Meteor.Error('not-authorized');

      var newStatus = scorecard.status === "new" ? "old" : "new";

      Scorecards.update({owner: this.userId}, {$set: {status: newStatus}}, function(error) {
        if(error) {
          throw new Meteor.Error(500, "There was an error toggling scorecard's status: " + (error.reason ? error.reason : error.message));               
        }
        else {
          console.log("Scorecard's status successfully updated.");

          //  Do an arbitrary update in a nested callback
          Tasks.update({ owner: userId }, {$set: {isReset: "Points Awarded!"}}, {multi: true}, function(error) {
            if(error) {
              throw new Meteor.Error(500, "There was updating tasks after toggling the status of a scorecard: " + (error.reason ? error.reason : error.message));
              console.log("scorecards.toggle: There was updating tasks after toggling the status of a scorecard: " + (error.reason ? error.reason : error.message));
            }
            else {
              /*//  Do an arbitrary update in a nested callback
              Tasks.update({ owner: userId }, {$set: {isReset: "Updated Again!"}}, {multi: true}, function(error) {
                if(error) {
                  throw new Meteor.Error(500, "There was updating tasks after toggling the status of a scorecard: " + (error.reason ? error.reason : error.message));
                  console.log("scorecards.toggle: There was updating tasks after toggling the status of a scorecard: " + (error.reason ? error.reason : error.message));
                }
              });*/
            }
          });
        }
      });
    }
  },
  'scorecards.remove'() {

    const scorecard = Scorecards.findOne({owner: this.userId});

    if(scorecard) {
      if (scorecard.owner !== this.userId) {
        // make sure only the owner can delete it
        throw new Meteor.Error('not-authorized');
      }

      Scorecards.remove({owner: this.userId});
    }
  },
});
