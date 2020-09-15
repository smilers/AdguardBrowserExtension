/**
 * This file is part of Adguard Browser Extension (https://github.com/AdguardTeam/AdguardBrowserExtension).
 *
 * Adguard Browser Extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Adguard Browser Extension is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Adguard Browser Extension.  If not, see <http://www.gnu.org/licenses/>.
 */

import { antiBannerService } from './filter/antibanner';
import { prefs } from './prefs';
import { log } from './utils/log';
import { utils } from './utils/common';
import { subscriptions } from './filter/filters/subscription';
import { filtersUpdate } from './filter/filters/filters-update';
import { listeners } from './notifier';

/**
 * AdGuard application class
 */
export const application = (() => {
    /**
     * Timeout for recently updated filters and again enabled filters - 5 minutes
     */
    const ENABLED_FILTERS_SKIP_TIMEOUT = 5 * 60 * 1000;

    const start = (options, callback) => {
        antiBannerService.start(options, callback);
    };

    const stop = callback => {
        antiBannerService.stop();
        callback();
    };

    /**
     * Checks application has been initialized
     * @returns {boolean}
     */
    const isInitialized = () => antiBannerService.isInitialized();

    /**
     * Offer filters on extension install, select default filters and filters by locale and country
     * @param callback
     */
    const offerFilters = (callback) => {
        // These filters are enabled by default
        const filterIds = [
            utils.filters.ENGLISH_FILTER_ID,
            utils.filters.SEARCH_AND_SELF_PROMO_FILTER_ID,
        ];
        if (prefs.mobile) {
            filterIds.push(utils.filters.MOBILE_ADS_FILTER_ID);
        }
        filterIds.concat(subscriptions.getLangSuitableFilters());
        callback(filterIds);
    };

    /**
     * List of enabled filters.
     * User filter and whitelist filter are always enabled so they are excluded.
     *
     * @returns {Array} List of enabled filters
     */
    const getEnabledFilters = () => subscriptions.getFilters()
        .filter(f => f.installed && f.enabled);

    const getEnabledFiltersFromEnabledGroups = () => {
        const filters = subscriptions.getFilters();
        const enabledGroupsIds = subscriptions.getGroups()
            .filter(g => g.enabled)
            .map(g => g.groupId);
        return filters.filter(f => f.enabled && enabledGroupsIds.includes(f.groupId));
    };

    /**
     * Checks if specified filter is enabled
     *
     * @param filterId Filter identifier
     * @returns {*} true if enabled
     */
    const isFilterEnabled = function (filterId) {
        const filter = subscriptions.getFilter(filterId);
        return filter && filter.enabled;
    };

    /**
     * Checks if specified filter is installed (downloaded)
     *
     * @param filterId Filter id
     * @returns {*} true if installed
     */
    const isFilterInstalled = function (filterId) {
        const filter = subscriptions.getFilter(filterId);
        return filter && filter.installed;
    };

    /**
     * Force checks updates for filters if specified or all filters
     *
     * @param successCallback
     * @param errorCallback
     * @param {Object[]} [filters] optional list of filters
     */
    const checkFiltersUpdates = (successCallback, errorCallback, filters) => {
        if (filters) {
            // Skip recently downloaded filters
            const outdatedFilters = filters.filter(f => (f.lastCheckTime
                ? Date.now() - f.lastCheckTime > ENABLED_FILTERS_SKIP_TIMEOUT
                : true));

            if (outdatedFilters.length > 0) {
                filtersUpdate.checkAntiBannerFiltersUpdate(
                    true,
                    successCallback,
                    errorCallback,
                    outdatedFilters
                );
            }
        } else {
            filtersUpdate.checkAntiBannerFiltersUpdate(true, successCallback, errorCallback);
        }
    };

    /**
     * Enable group
     * @param {number} groupId filter group identifier
     */
    const enableGroup = function (groupId) {
        const group = subscriptions.getGroup(groupId);
        if (!group || group.enabled) {
            return;
        }
        group.enabled = true;
        listeners.notifyListeners(listeners.FILTER_GROUP_ENABLE_DISABLE, group);
    };

    /**
     * Disable group
     * @param {number} groupId filter group identifier
     */
    const disableGroup = function (groupId) {
        const group = subscriptions.getGroup(groupId);
        if (!group || !group.enabled) {
            return;
        }
        group.enabled = false;
        listeners.notifyListeners(listeners.FILTER_GROUP_ENABLE_DISABLE, group);
    };

    /**
     * Enable filter
     *
     * @param {Number} filterId Filter identifier
     * @param {{forceGroupEnable: boolean}} [options]
     * @returns {boolean} true if filter was enabled successfully
     */
    const enableFilter = (filterId, options) => {
        const filter = subscriptions.getFilter(filterId);
        if (!filter || filter.enabled || !filter.installed) {
            return false;
        }
        filter.enabled = true;
        /**
         * we enable group if it was never enabled or disabled early
         */
        const { groupId } = filter;
        const forceGroupEnable = options && options.forceGroupEnable;
        if (!subscriptions.groupHasEnabledStatus(groupId) || forceGroupEnable) {
            enableGroup(groupId);
        }
        listeners.notifyListeners(listeners.FILTER_ENABLE_DISABLE, filter);
        return true;
    };

    /**
     * Successively add filters from filterIds and then enable successfully added filters
     * @param filterIds Filter identifiers
     * @param {{forceGroupEnable: boolean}} [options]
     * @param callback We pass list of enabled filter identifiers to the callback
     */
    const addAndEnableFilters = (filterIds, callback, options) => {
        callback = callback || function noop() {}; // empty callback

        const enabledFilters = [];

        if (!filterIds || filterIds.length === 0) {
            callback(enabledFilters);
            return;
        }

        filterIds = utils.collections.removeDuplicates(filterIds.slice(0));
        const loadNextFilter = () => {
            if (filterIds.length === 0) {
                callback(enabledFilters);
            } else {
                const filterId = filterIds.shift();
                antiBannerService.addAntiBannerFilter(filterId, (success) => {
                    if (success) {
                        const changed = enableFilter(filterId, options);
                        if (changed) {
                            const filter = subscriptions.getFilter(filterId);
                            enabledFilters.push(filter);
                        }
                    }
                    loadNextFilter();
                });
            }
        };

        loadNextFilter();
    };

    /**
     * Disables filters by id
     *
     * @param {Array.<Number>} filterIds Filter identifiers
     * @returns {boolean} true if filter was disabled successfully
     */
    const disableFilters = function (filterIds) {
        // Copy array to prevent parameter mutation
        filterIds = utils.collections.removeDuplicates(filterIds.slice(0));
        for (let i = 0; i < filterIds.length; i += 1) {
            const filterId = filterIds[i];
            const filter = subscriptions.getFilter(filterId);
            if (!filter || !filter.enabled || !filter.installed) {
                continue;
            }
            filter.enabled = false;
            listeners.notifyListeners(listeners.FILTER_ENABLE_DISABLE, filter);
        }
    };

    /**
     * Uninstalls filters
     *
     * @param {Array.<Number>} filterIds Filter identifiers
     * @returns {boolean} true if filter was removed successfully
     */
    const uninstallFilters = function (filterIds) {
        // Copy array to prevent parameter mutation
        filterIds = utils.collections.removeDuplicates(filterIds.slice(0));

        for (let i = 0; i < filterIds.length; i += 1) {
            const filterId = filterIds[i];
            const filter = subscriptions.getFilter(filterId);
            if (!filter || !filter.installed) {
                continue;
            }

            log.debug('Uninstall filter {0}', filter.filterId);

            filter.enabled = false;
            filter.installed = false;
            listeners.notifyListeners(listeners.FILTER_ENABLE_DISABLE, filter);
            listeners.notifyListeners(listeners.FILTER_ADD_REMOVE, filter);
        }
    };

    /**
     * Removes filter
     *
     * @param {Number} filterId Filter identifier
     */
    const removeFilter = function (filterId) {
        const filter = subscriptions.getFilter(filterId);
        if (!filter || filter.removed) {
            return;
        }

        if (!filter.customUrl) {
            log.error('Filter {0} is not custom and could not be removed', filter.filterId);
            return;
        }

        log.debug('Remove filter {0}', filter.filterId);

        filter.enabled = false;
        filter.installed = false;
        filter.removed = true;
        listeners.notifyListeners(listeners.FILTER_ENABLE_DISABLE, filter);
        listeners.notifyListeners(listeners.FILTER_ADD_REMOVE, filter);
    };

    /**
     * Loads filter rules from url, then tries to parse header to filter metadata
     * and adds filter object to subscriptions from it.
     * These custom filters will have special attribute customUrl, from there it could be downloaded and updated.
     *
     * @param url custom url, there rules are
     * @param options object containing title of custom filter
     * @param successCallback
     * @param errorCallback
     */
    const loadCustomFilter = function (url, options, successCallback, errorCallback) {
        log.info('Downloading custom filter from {0}', url);

        if (!url) {
            errorCallback();
            return;
        }

        subscriptions.updateCustomFilter(url, options, (filterId) => {
            if (filterId) {
                log.info('Custom filter downloaded');

                const filter = subscriptions.getFilter(filterId);
                // In case filter is loaded again and was removed before
                delete filter.removed;
                successCallback(filter);
            } else {
                errorCallback();
            }
        });
    };

    const loadCustomFilterInfo = (url, options, successCallback, errorCallback) => {
        log.info(`Downloading custom filter info from ${url}`);
        if (!url) {
            errorCallback();
            return;
        }

        subscriptions.getCustomFilterInfo(url, options, (result = {}) => {
            const { error, filter } = result;
            if (filter) {
                log.info('Custom filter data downloaded');
                successCallback(filter);
                return;
            }
            errorCallback(error);
        });
    };

    return {

        start,
        stop,
        isInitialized,

        offerFilters,

        getEnabledFilters,

        isFilterEnabled,
        isFilterInstalled,

        checkFiltersUpdates,

        addAndEnableFilters,
        disableFilters,
        uninstallFilters,
        removeFilter,

        enableGroup,
        disableGroup,

        loadCustomFilter,
        loadCustomFilterInfo,
        getEnabledFiltersFromEnabledGroups,
    };
})();