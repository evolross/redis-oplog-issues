import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

import './task.html';

Template.task.helpers({
  isOwner() {
    return this.owner === Meteor.userId();
  },
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
});
