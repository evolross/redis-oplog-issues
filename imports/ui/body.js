import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';

import { Tasks } from '../api/tasks.js';
import { Scorecards } from '../api/scorecards.js';

import './task.js';
import './body.html';

Template.body.onCreated(function bodyOnCreated() {

  //  Set instance reference
  var instance = this;

  instance.state = new ReactiveDict();

  //  Create reactive var to hold page
  instance.page = new ReactiveVar(0);
  instance.tasksPerPage = 5;

  //Meteor.subscribe('tasks');

  //  Autorun Subscription
  instance.autorun(function() {

    instance.subscriptions = [
      instance.subscribe('tasksByPage', instance.tasksPerPage, instance.tasksPerPage * instance.page.get()),
      instance.subscribe('scorecard')
    ];
  });

});

Template.body.helpers({
  tasks() {
    const instance = Template.instance();
    if (instance.state.get('hideCompleted')) {
      // If hide completed is checked, filter tasks
      return Tasks.find({ checked: { $ne: true } }, { sort: { createdAt: -1 } });
    }
    // Otherwise, return all of the tasks
    return Tasks.find({}, { sort: { createdAt: -1 } });
  },
  scorecard() {
    const instance = Template.instance();
    
    //  Return the user's scorecard
    return Scorecards.findOne();
  },
  incompleteCount() {
    return Tasks.find({ checked: { $ne: true } }).count();
  },
});

Template.body.events({
  'click .previous-five-tasks'(event, instance) {
    //  If there's pages behind where we're presently at, decrement the page
    if(instance.page.get() > 0)
      instance.page.set(instance.page.get() - 1);
  },

  'click .next-five-tasks'(event, instance) {

    //console.log("instance.page.get(): ", instance.page.get());

    //  THIS IS A HACK AS IN MY REAL APP I DENORMALIZE THE "TASK COUNT" ON ANOTHER COLLECTION
    //  FOR THIS REPO, I'M JUST HARD-CODING IT
    var taskCount = 20;

    /*console.log("instance.page.get(): ", instance.page.get());
    console.log("taskCount: ", taskCount);
    console.log("Math.floor(taskCount / instance.tasksPerPage) - 1: ", Math.floor(taskCount / instance.tasksPerPage) - 1);*/

    //  If there's pages available to go to, increment the page
    if(taskCount > 0 && instance.page.get() < (Math.floor(taskCount / instance.tasksPerPage) - 1))
      instance.page.set(instance.page.get() + 1);
  },

  'submit .new-task'(event) {
    // Prevent default browser form submit
    event.preventDefault();

    // Get value from form element
    const target = event.target;
    const text = target.text.value;

    // Insert a task into the collection
    Meteor.call('tasks.insert', text);

    // Clear form
    target.text.value = '';
  },
  'change .hide-completed input'(event, instance) {
    instance.state.set('hideCompleted', event.target.checked);
  },
  'click .delete-scorecard'(event, instance) {
    Meteor.call('scorecards.remove');
  },
  'click .remove-all-tasks'(event, instance) {
    Meteor.call('tasks.removeAll');
  },
  'click .add-twenty-tasks'(event, instance) {
    //  Loop twenty times over insert to insert twenty tasks easily
    for (var index = 0; index < 20; index++) {
      // Insert a task into the collection
      Meteor.call('tasks.insert', "This is task number " + (index + 1) + ".");
    }
  },
  'click .reset-tasks'(event, instance) {
      // Call reset tasks Meteor Method
      Meteor.call('resetTasks', function(error) {
        if(error)
          console.log("Error calling resetTasks", (error.reason ? error.reason : error.message));
      });
  }
});
