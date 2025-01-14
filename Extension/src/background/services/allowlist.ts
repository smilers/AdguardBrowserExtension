/**
 * @file
 * This file is part of AdGuard Browser Extension (https://github.com/AdguardTeam/AdguardBrowserExtension).
 *
 * AdGuard Browser Extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * AdGuard Browser Extension is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdGuard Browser Extension. If not, see <http://www.gnu.org/licenses/>.
 */
import { logger } from '../../common/logger';
import {
    MessageType,
    SaveAllowlistDomainsMessage,
    AddAllowlistDomainPopupMessage,
    RemoveAllowlistDomainMessage,
} from '../../common/messages';
import { messageHandler } from '../message-handler';
import { Engine } from '../engine';
import { SettingOption } from '../schema';
import { AllowlistApi, TabsApi } from '../api';
import {
    ContextMenuAction,
    contextMenuEvents,
    settingsEvents,
} from '../events';
import { Prefs } from '../prefs';

export type GetAllowlistDomainsResponse = {
    content: string,
    appVersion: string,
};

/**
 * Service for processing events with a allowlist.
 */
export class AllowlistService {
    /**
     * Initialize handlers.
     */
    public static init(): void {
        messageHandler.addListener(MessageType.GetAllowlistDomains, AllowlistService.onGetAllowlistDomains);
        messageHandler.addListener(MessageType.SaveAllowlistDomains, AllowlistService.handleDomainsSave);
        messageHandler.addListener(MessageType.AddAllowlistDomainPopup, AllowlistService.onAddAllowlistDomain);
        messageHandler.addListener(MessageType.RemoveAllowlistDomain, AllowlistService.onRemoveAllowlistDomain);

        settingsEvents.addListener(SettingOption.AllowlistEnabled, Engine.debounceUpdate);
        settingsEvents.addListener(SettingOption.DefaultAllowlistMode, Engine.debounceUpdate);

        contextMenuEvents.addListener(
            ContextMenuAction.SiteFilteringOn,
            AllowlistService.enableSiteFilteringFromContextMenu,
        );
        contextMenuEvents.addListener(
            ContextMenuAction.SiteFilteringOff,
            AllowlistService.disableSiteFilteringFromContextMenu,
        );
    }

    /**
     * Returns domains depending on current allowlist mode.
     *
     * @returns Object of type {@link GetAllowlistDomainsResponse}.
     */
    private static onGetAllowlistDomains(): GetAllowlistDomainsResponse {
        const domains = AllowlistApi.isInverted()
            ? AllowlistApi.getInvertedAllowlistDomains()
            : AllowlistApi.getAllowlistDomains();

        const content = domains.join('\n');

        return { content, appVersion: Prefs.version };
    }

    /**
     * The listener for the allowlist domain addition event from popup.
     *
     * @param message Message of type {@link AddAllowlistDomainPopupMessage}.
     */
    private static async onAddAllowlistDomain(message: AddAllowlistDomainPopupMessage): Promise<void> {
        const { tabId } = message.data;

        await AllowlistApi.disableTabFiltering(tabId);
    }

    /**
     * The listener for the allowlist domain deletion event.
     *
     * @param message Message of type {@link RemoveAllowlistDomainMessage}.
     */
    private static async onRemoveAllowlistDomain(message: RemoveAllowlistDomainMessage): Promise<void> {
        const { tabId, tabRefresh } = message.data;

        await AllowlistApi.enableTabFiltering(tabId, tabRefresh);
    }

    /**
     * Stores domains depending on current allowlist mode.
     *
     * @param message Message data.
     */
    private static async handleDomainsSave(message: SaveAllowlistDomainsMessage): Promise<void> {
        const { value } = message.data;

        const domains = value.split(/[\r\n]+/);

        if (AllowlistApi.isInverted()) {
            AllowlistApi.setInvertedAllowlistDomains(domains);
        } else {
            AllowlistApi.setAllowlistDomains(domains);
        }

        await Engine.update();
    }

    /**
     * Listener for an event to enable site filtering from the context menu.
     */
    private static async enableSiteFilteringFromContextMenu(): Promise<void> {
        const activeTab = await TabsApi.getActive();

        if (activeTab?.id) {
            await AllowlistApi.enableTabFiltering(activeTab.id, true);
        } else {
            logger.warn('Cannot open site report page for active tab');
        }
    }

    /**
     * Listener for an event to disable site filtering from the context menu.
     */
    private static async disableSiteFilteringFromContextMenu(): Promise<void> {
        const activeTab = await TabsApi.getActive();

        if (activeTab?.id) {
            await AllowlistApi.disableTabFiltering(activeTab.id);
        } else {
            logger.warn('Cannot open site report page for active tab');
        }
    }
}
