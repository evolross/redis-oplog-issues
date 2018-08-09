import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

import './task.html';

import { Tasks } from '../api/tasks.js';

Template.task.helpers({
  isOwner() {
    return this.owner === Meteor.userId();
  },
  hasStatusColor() {
    console.log("Task ", this.order, " hasStatusColor: ", !!this.color);
    return !!this.color;
  }
});

Template.task.events({
  'click .toggle-checked'() {
    // Set the checked property to the opposite of its current value
    Meteor.call('tasks.setChecked', this._id, !this.checked);

    if(!this.checked) {
      // Upsert the scorecard with twenty points for a complete task
      Meteor.call('scorecard.upsert', 20);
    }
  },
  'click .delete'() {
    Meteor.call('tasks.remove', this._id);
  },
  'click .toggle-private'() {
    Meteor.call('tasks.setPrivate', this._id, !this.private);
  },
  'click .insert-task-client'() {

    let order = this.order + 1;
    let userId = Meteor.userId();

    //console.log("client: order: ", order);

    Tasks.insert({
      text: "This is NEW task number " + order + ".",
      order: order,
      color: "#1a9604",
      isReset: "Not Reset Yet",
      createdAt: new Date(),
      owner: userId,
      username: Meteor.users.findOne(userId).username,
    }, function(error) {
      if(error) {
        console.log("Error inserting a task from the client.", error.message);
      }
    });
  },

  'click .unset-status'() {

    let taskId = this._id;

    //console.log("taskId: ", taskId);

    Tasks.update({_id: taskId}, {$unset: {color: ""}}, function(error) {
      if(error) {
        console.log("Error removing a task's color with $unset from the client.", error.message);
      }
    });
  }
});
