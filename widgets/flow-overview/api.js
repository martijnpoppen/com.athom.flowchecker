'use strict';

module.exports = {
  async getSettings({ homey }) {
    const _settingsKey = `com.athom.flowchecker.settings`;
    return homey.settings.get(_settingsKey);
  },
};
