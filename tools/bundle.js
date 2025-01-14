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

/* eslint-disable no-console,no-restricted-syntax,no-await-in-loop */
import { program } from 'commander';

import { bundleRunner } from './bundle/bundle-runner';
import { copyExternals } from './bundle/copy-external';
import { BROWSERS, ENVS } from './constants';
import { getWebpackConfig } from './bundle/webpack-config';
import { crx } from './bundle/crx';
import { buildInfo } from './bundle/build-info';
import { buildUpdateJson } from './bundle/firefox/updateJson';

const bundleChrome = (watch) => {
    const webpackConfig = getWebpackConfig(BROWSERS.CHROME, watch);
    return bundleRunner(webpackConfig, watch);
};

const bundleFirefoxAmo = (watch) => {
    const webpackConfig = getWebpackConfig(BROWSERS.FIREFOX_AMO, watch);
    return bundleRunner(webpackConfig, watch);
};

const bundleFirefoxStandalone = async () => {
    const webpackConfig = getWebpackConfig(BROWSERS.FIREFOX_STANDALONE);
    await buildUpdateJson();
    return bundleRunner(webpackConfig);
};

const bundleEdge = (watch) => {
    const webpackConfig = getWebpackConfig(BROWSERS.EDGE, watch);
    return bundleRunner(webpackConfig, watch);
};

const bundleOpera = (watch) => {
    const webpackConfig = getWebpackConfig(BROWSERS.OPERA, watch);
    return bundleRunner(webpackConfig, watch);
};

const bundleChromeCrx = async () => {
    await crx(BROWSERS.CHROME);
};

const devPlan = [
    copyExternals,
    bundleChrome,
    bundleFirefoxAmo,
    bundleFirefoxStandalone,
    bundleEdge,
    bundleOpera,
    buildInfo,
];

const betaPlan = [
    copyExternals,
    bundleChrome,
    bundleChromeCrx,
    bundleEdge,
    buildInfo,
];

const firefoxStandalonePlan = [
    copyExternals,
    bundleFirefoxStandalone,
    buildInfo,
];

const releasePlan = [
    copyExternals,
    bundleChrome,
    bundleFirefoxAmo,
    bundleEdge,
    bundleOpera,
    buildInfo,
];

const runBuild = async (tasks) => {
    for (const task of tasks) {
        await task();
    }
};

const mainBuild = async () => {
    switch (process.env.BUILD_ENV) {
        case ENVS.DEV: {
            await runBuild(devPlan);
            break;
        }
        case ENVS.BETA: {
            await runBuild(betaPlan);
            break;
        }
        case ENVS.RELEASE: {
            await runBuild(releasePlan);
            break;
        }
        default:
            throw new Error('Provide BUILD_ENV to choose correct build plan');
    }
};

const main = async () => {
    try {
        await mainBuild();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

const chrome = async (watch) => {
    try {
        await bundleChrome(watch);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

const edge = async (watch) => {
    try {
        await bundleEdge(watch);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

const opera = async (watch) => {
    try {
        await bundleOpera(watch);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

const firefox = async (watch) => {
    try {
        await bundleFirefoxAmo(watch);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

const firefoxStandalone = async () => {
    try {
        await runBuild(firefoxStandalonePlan);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

program
    .option('--watch', 'Builds in watch mode', false);

program
    .command('chrome')
    .description('Builds extension for chrome browser')
    .action(() => {
        chrome(program.watch);
    });

program
    .command('edge')
    .description('Builds extension for edge browser')
    .action(() => {
        edge(program.watch);
    });

program
    .command('opera')
    .description('Builds extension for opera browser')
    .action(() => {
        opera(program.watch);
    });

program
    .command('firefox')
    .description('Builds extension for firefox browser')
    .action(() => {
        firefox(program.watch);
    });

program
    .command('firefox-standalone')
    .description('Builds signed extension for firefox browser')
    .action(() => {
        firefoxStandalone();
    });

program
    .description('By default builds for all platforms')
    .action(main);

program.parse(process.argv);
