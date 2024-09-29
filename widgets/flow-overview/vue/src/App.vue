<script>
import { unref, ref, onMounted, computed } from "vue";
import Loader from "./components/Loader.vue";

export default {
  name: "App",
  props: {
    Homey: {
      type: Object,
      required: true,
    },
  },
  components: {
    Loader,
  },
  setup(props) {
    const Homey = props.Homey;
    const appSettings = ref(null);
    const widgetSettings = ref(null);
    const showFolders = ref(false);

    const isLoading = computed(() => {
      return !appSettings.value || !widgetSettings.value;
    });

    onMounted(async () => {
      appSettings.value = await Homey.api("GET", "/");
      widgetSettings.value = await Homey.getSettings();

      console.log("Mounted", appSettings.value, widgetSettings.value);
    });

    function i18n(key) {
      return Homey.__(key);
    }

    function getAppSetting(key, defaultValue) {
      return unref(appSettings)?.[key] || defaultValue;
    }

    function getAppSubSetting(key, subKey, defaultValue) {
      return getAppSetting(key, {})[subKey] || defaultValue;
    }

    function getAppSettingLength(key) {
      return getAppSetting(key, 0).length;
    }

    const filteredFolders = computed(() => {
      const filtered = getAppSetting("FILTERED_FOLDERS");
      const folders = getAppSetting("FOLDERS");

      const mappedFiltered =
        filtered?.map((folderId) => {
          return folders?.find((folder) => folder.id === folderId);
        }) || [];

      console.log("filtered", filtered, folders, mappedFiltered);

      return mappedFiltered;
    });

    return {
      filteredFolders,
      appSettings,
      getAppSetting,
      getAppSettingLength,
      getAppSubSetting,
      i18n,
      isLoading,
      widgetSettings,
    };
  },
};
</script>

<template>
  <main>
    <table class="homey-table-striped">
      <thead>
        <tr>
          <th>{{ i18n("settings.flows_overview") }}</th>
          <th>{{ i18n("settings.flows_amount") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{{ i18n("settings.flows_broken") }}</td>
          <td v-if="isLoading"><Loader /></td>
          <td v-else>{{ getAppSettingLength("BROKEN") }}</td>
        </tr>
        <tr>
          <td>{{ i18n("settings.flows_disabled") }}</td>
          <td v-if="isLoading"><Loader /></td>
          <td v-else>{{ getAppSettingLength("DISABLED") }}</td>
        </tr>
        <tr>
          <td>{{ i18n("settings.flows_broken_variable") }}</td>
          <td v-if="isLoading"><Loader /></td>
          <td v-else>{{ getAppSettingLength("BROKEN_VARIABLE") }}</td>
        </tr>
        <tr>
          <td>{{ i18n("settings.unused_flows") }}</td>
          <td v-if="isLoading"><Loader /></td>
          <td v-else>{{ getAppSettingLength("UNUSED_FLOWS") }}</td>
        </tr>
        <tr>
          <td>{{ i18n("settings.unused_logic") }}</td>
          <td v-if="isLoading"><Loader /></td>
          <td v-else>{{ getAppSettingLength("UNUSED_LOGIC") }}</td>
        </tr>
        <tr>
          <td>{{ i18n("settings.all_flows") }}</td>
          <td v-if="isLoading"><Loader /></td>
          <td v-else>{{ getAppSetting("ALL_FLOWS") }}</td>
        </tr>
        <tr>
          <td>{{ i18n("settings.all_screensavers") }}</td>
          <td v-if="isLoading"><Loader /></td>
          <td v-else>{{ getAppSetting("ALL_SCREENSAVERS") }}</td>
        </tr>

        <tr>
          <td>{{ i18n("settings.all_variables") }}</td>
          <td v-if="isLoading"><Loader /></td>
          <td v-else>{{ getAppSetting("ALL_VARIABLES") }}</td>
        </tr>
        <tr>
          <td>{{ i18n("settings.all_variables_logic") }}</td>
          <td v-if="isLoading"><Loader /></td>
          <td v-else>
            {{ getAppSubSetting("ALL_VARIABLES_OBJ", "logic", 0) }}
          </td>
        </tr>
        <tr>
          <td>{{ i18n("settings.all_variables_device") }}</td>
          <td v-if="isLoading"><Loader /></td>
          <td v-else>
            {{ getAppSubSetting("ALL_VARIABLES_OBJ", "device", 0) }}
          </td>
        </tr>
        <tr>
          <td>{{ i18n("settings.all_variables_app") }}</td>
          <td v-if="isLoading"><Loader /></td>
          <td v-else>{{ getAppSubSetting("ALL_VARIABLES_OBJ", "app", 0) }}</td>
        </tr>
        <tr>
          <td>{{ i18n("settings.all_variables_bl") }}</td>
          <td v-if="isLoading"><Loader /></td>
          <td v-else>{{ getAppSubSetting("ALL_VARIABLES_OBJ", "bl", 0) }}</td>
        </tr>
        <tr>
          <td>{{ i18n("settings.all_variables_fu") }}</td>
          <td v-if="isLoading"><Loader /></td>
          <td v-else>{{ getAppSubSetting("ALL_VARIABLES_OBJ", "fu", 0) }}</td>
        </tr>
        <tr>
          <td>{{ i18n("settings.all_variables_screensavers") }}</td>
          <td v-if="isLoading"><Loader /></td>
          <td v-else>
            {{ getAppSubSetting("ALL_VARIABLES_OBJ", "screensavers", 0) }}
          </td>
        </tr>
      </tbody>
    </table>
    <table v-if="showFolders" class="homey-table-striped">
      <thead>
        <tr>
          <th>{{ i18n("settings.filtered_folders") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="isLoading">
          <td><Loader /></td>
        </tr>
        <tr v-else>
          <td v-for="folder in filteredFolders" :key="folder.id">
            {{ folder.name }}
          </td>
        </tr>
      </tbody>
    </table>
  </main>
</template>
