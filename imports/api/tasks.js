import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import { Match } from 'meteor/check';

export const Tasks = new Mongo.Collection('tasks');

if (Meteor.isServer) {
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

    //  Return page-limit of tasks at a time, sorted by their creation date, and skipped to the correct page
    return Tasks.find({
      $or: [
        { private: { $ne: true } },
        { owner: this.userId },
      ],
    }, {
      sort: {createdAt: 1},
      limit: limit,
      skip: skip
    });
  });
}

Meteor.methods({
  'tasks.insert'(text) {
    check(text, String);

    // Make sure the user is logged in before inserting a task
    if (! this.userId) {
      throw new Meteor.Error('not-authorized');
    }

    Tasks.insert({
      text,
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

    Tasks.remove({ owner: this.userId }, function(error) {
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

    //  Call internal server function - DOING IT THIS WAY BECAUSE THIS IS HOW MY APP DOES IT - TRYING TO MIMIC MY APP
    //_resetTasks();

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