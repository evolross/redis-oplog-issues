import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import { Match } from 'meteor/check';
import { Scorecards } from './scorecards.js';

export const Tasks = new Mongo.Collection('tasks');

Tasks.allow({
  insert: function(userId, doc) { 
    return true;
  },
  update: function(userId, doc, fieldNames, modifier) {
    return true;
  }
});

if (Meteor.isServer) {

  //  Before a task is inserted
  Tasks.after.insert(function (userId, doc) {

    //  Increment all tasks order by one after this task (so this gets inserted in the correct order)
    var taskOrder = doc.order;
    //var totalTasks = Tasks.find({}, {fields: {_id: 1}}).count();

    //console.log("taskOrder: ", taskOrder);
    //console.log("totalTasks: ", totalTasks);

    Tasks.direct.update({order: {$gte: taskOrder}, _id: {$ne: doc._id}}, {$inc: {order: 1}}, {multi: true}, function(error) {
      if(error) {
        throw new Meteor.Error(500, "SERVER ERROR: Tasks.before.insert: Error incrementing order of existing tasks. " + (error.reason ? error.reason : error.message));
      }
      else {
        console.log("Successfully incremented tasks.");
      }
    });

  });

  Tasks.before.update(function (userId, doc, fieldNames, modifier, options) {

    if(modifier.$set && modifier.$set.isReset) {
      //console.log("Tasks.before.update: isReset is being set...");

      //  Increment the Scorecard's points
      Scorecards.update({owner: userId}, {$inc: {points: 1}}, function(error) {
        // Display the error to the user
        if(error) {
          // Display the error to the user
          console.log("SERVER ERROR: Tasks.before.update: Error updating Scorecard's points in collection hook: " + (error.reason ? error.reason : error.message));  
          throw new Meteor.Error(500, "Error updating Scorecard's points in collection hook: " + (error.reason ? error.reason : error.message));  
        }
        //else {
          //console.log("Tasks.before.update successfully incremented the user's Scorecard.");
        //}
      });
    }

  });

  //  After a task is removed
  Tasks.before.remove(function (userId, doc) {

    //  Decrement the order of the remaining tasks after this task
    var taskOrder = doc.order + 1;
    //var totalTasks = Tasks.find({}, {fields: {_id: 1}}).count();

    //console.log("Tasks.before.remove: taskOrder: ", taskOrder);

    Tasks.update({order: {$gte: taskOrder}}, {$inc: {order: -1}}, {multi: true}, function(error) {
      if(error) {
        throw new Meteor.Error(500, "SERVER ERROR: Tasks.before.remove: Error deccrementing order of existing tasks. " + (error.reason ? error.reason : error.message));
      }
      /*else {
        console.log("Successfully decremented tasks.");
      }*/
    });
  });

  // This code only runs on the server
  // Only publish tasks that are public or belong to the current user
  Meteor.publish('tasks', function tasksPublication() {
    return Tasks.find({
      $or: [
        { private: { $ne: true } },
        { owner: this.userId },
      ],
    });
  });

  //  Publish paginated
  Meteor.publish('tasksByPage', function(limit, skip) {
    // Check inputs
    var positiveIntegerCheck = Match.Where(function(x) {
        check(x, Match.Integer);
        return x >= 0;
    });
    check(limit, positiveIntegerCheck);
    check(skip, positiveIntegerCheck);

    let self = this;

    //console.log("limit: ", limit);
    //console.log("skip: ", skip);

    //  Return page-limit of tasks at a time, sorted by their creation date, and skipped to the correct page
    var tasksHandle = Tasks.find({
      $or: [
        { private: { $ne: true } },
        { owner: this.userId },
      ],
    }, {
      sort: {order: 1, createdAt: 1},
      limit: limit,
      skip: skip
    }).observe({
      added: function (added) {

        //console.log("tasksByPage: added: ", added);

        self.added("tasks", added._id, added);
      },
      changed: function(changed, old) {

        //console.log("tasksByPage: changed - new: ", changed);
        //console.log("tasksByPage: changed - old: ", old);

        self.changed("tasks", changed._id, changed);
      },
      removed: function(removed) {

        //console.log("tasksByPage: removed: ", removed);

        self.removed("tasks", removed._id);
      }

    });

    //  Mark the subscription as ready
    self.ready();

    // Stop observing the cursor when client unsubs.
    self.onStop(function () {
      tasksHandle.stop();
    });

  });
}

Meteor.methods({
  'tasks.insert'(text, order) {
    check(text, String);
    check(order, Number);

    // Make sure the user is logged in before inserting a task
    if (! this.userId) {
      throw new Meteor.Error('not-authorized');
    }

    Tasks.direct.insert({
      text: text,
      order: order,
      color: "#1a9604",
      isReset: "Not Reset Yet",
      createdAt: new Date(),
      owner: this.userId,
      username: Meteor.users.findOne(this.userId).username,
    });
  },
  'tasks.remove'(taskId) {
    check(taskId, String);

    const task = Tasks.findOne(taskId);
    if (task.private && task.owner !== this.userId) {
      // If the task is private, make sure only the owner can delete it
      throw new Meteor.Error('not-authorized');
    }

    Tasks.remove(taskId);
  },
  'tasks.removeAll'() {

    // Make sure the user is logged in before inserting a task
    if (! this.userId) {
      throw new Meteor.Error('not-authorized');
    }

    Tasks.direct.remove({ owner: this.userId }, function(error) {
      if(error)
        throw new Meteor.Error("SERVER ERROR: Removing all users tasks. ", error.message);
    });
  },
  'tasks.setChecked'(taskId, setChecked) {
    check(taskId, String);
    check(setChecked, Boolean);

    const task = Tasks.findOne(taskId);
    if (task.private && task.owner !== this.userId) {
      // If the task is private, make sure only the owner can check it off
      throw new Meteor.Error('not-authorized');
    }

    Tasks.update(taskId, { $set: { checked: setChecked } });
  },
  'tasks.setPrivate'(taskId, setToPrivate) {
    check(taskId, String);
    check(setToPrivate, Boolean);

    const task = Tasks.findOne(taskId);

    // Make sure only the task owner can make a task private
    if (task.owner !== this.userId) {
      throw new Meteor.Error('not-authorized');
    }

    Tasks.update(taskId, { $set: { private: setToPrivate } });
  },
  resetTasks: function() {

    var userId = Meteor.userId();

    //  Ensures a user is logged in
    if(!userId) {
      console.log("SERVER ERROR: resetTasks: You need to be logged in to reset tasks."); 
      throw new Meteor.Error(401, 'You need to be logged in to reset tasks.');
    }

    //  Find the tasks       
    var tasks = [];

    //  THIS IS THE OFFENDING CODE!!!
    //  THIS IS THE OFFENDING CODE!!!
    //  THIS IS THE OFFENDING CODE!!!
    //  THIS IS THE OFFENDING CODE!!!
    tasks = Tasks.find({
      $or: [
        { private: { $ne: true } },
        { owner: this.userId },
      ],
    }).fetch();

    //  THIS IS THE OFFENDING CODE!!!
    //  THIS IS THE OFFENDING CODE!!!
    //  THIS IS THE OFFENDING CODE!!!
    //  THIS IS THE OFFENDING CODE!!!
    //  Update all tasks with something arbitrary
    Tasks.update({_id: {$in: _.pluck(tasks, '_id')}}, {$set: {isReset: "Was Reset!"}}, {multi: true}, function(error) {
        if(error) {
            console.log("SERVER ERROR: resetTasks: Server Error resetting all tasks: " + (error.reason ? error.reason : error.message));
            throw new Meteor.Error(500, "Server Error resetting all tasks: " + (error.reason ? error.reason : error.message));                    
        }
    });
  }

});