// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { IonRouterOutlet } from '@ionic/angular';
import { BackButtonEvent } from '@ionic/core';

import { CoreLoginHelper } from '@features/login/services/login-helper';
import { SplashScreen } from '@singletons';
import { CoreApp } from '@services/app';
import { CoreNavigator } from '@services/navigator';
import { CoreSubscriptions } from '@singletons/subscriptions';
import { CoreWindow } from '@singletons/window';
import { CorePlatform } from '@services/platform';
import { CoreLogger } from '@singletons/logger';
import { CorePromisedValue } from '@classes/promised-value';
import { register } from 'swiper/element/bundle';
import { CoreWait } from '@singletons/wait';
import { CoreOpener } from '@singletons/opener';
import { CoreLang } from '@services/lang';

register();

@Component({
    selector: 'app-root',
    templateUrl: 'app.component.html',
})
export class AppComponent implements OnInit, AfterViewInit {

    @ViewChild(IonRouterOutlet) outlet?: IonRouterOutlet;

    protected logger = CoreLogger.getInstance('AppComponent');

    /**
     * @inheritdoc
     */
    ngOnInit(): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = <any>window;
        this.setAppDirection();
        CorePlatform.resume.subscribe(() => {
            // Wait a second before setting it to false since in iOS there could be some frozen WS calls.
            setTimeout(() => {
                if (CoreLoginHelper.isWaitingForBrowser() && !CoreOpener.isInAppBrowserOpen()) {
                    CoreLoginHelper.stopWaitingForBrowser();
                    CoreLoginHelper.checkLogout();
                }
            }, 1000);
        });
        // "Expose" CoreWindow.open.
        win.openWindowSafely = (url: string, name?: string): void => {
            CoreWindow.open(url, name);
        };

        // Treat URLs that try to override the app.
        win.onOverrideUrlLoading = (url: string) => {
            CoreWindow.open(url);
        };
        // Quit app with back button.
        document.addEventListener('ionBackButton', (event: BackButtonEvent) => {
            // This callback should have the lowest priority in the app.
            event.detail.register(-100, async () => {
                const initialPath = CoreNavigator.getCurrentPath();
                if (initialPath.startsWith('/main/')) {
                    // Main menu has its own callback to handle back. If this callback is called it means we should exit app.
                    CoreApp.closeApp();

                    return;
                }

                await CoreWait.wait(50);

                if (CoreNavigator.getCurrentPath() != initialPath) {
                    return;
                }
                CoreApp.closeApp();
            });
        });

        // @todo Pause Youtube videos in Android when app is put in background or screen is locked?
        // See: https://github.com/moodlehq/moodleapp/blob/ionic3/src/app/app.component.ts#L312
    }
    /**
       * Check language on app startup and apply RTL if the language is Arabic.
       */
    private async setAppDirection(): Promise<void> {
        const currentLanguage = await CoreLang.getCurrentLanguage();

        if (currentLanguage === 'ar') {
            // Set direction to RTL for Arabic language
            document.documentElement.setAttribute('dir', 'rtl');
        } else {
            // Set direction to LTR for other languages
            document.documentElement.setAttribute('dir', 'ltr');
        }
    }
    /**
     * @inheritdoc
     */
    ngAfterViewInit(): void {
        if (!this.outlet) {
            return;
        }

        this.logger.debug('App component initialized');

        CoreSubscriptions.once(this.outlet.activateEvents, async () => {
            await CorePlatform.ready();

            this.logger.debug('Hide splash screen');
            SplashScreen.hide();
            this.setSystemUIColorsAfterSplash();
        });
    }

    /**
     * Set the system UI Colors after hiding the splash to ensure it's correct.
     *
     * @returns Promise resolved when done.
     */
    protected async setSystemUIColorsAfterSplash(): Promise<void> {
        // When the app starts and the splash is hidden, the color of the bars changes from transparent to black.
        // We have to set the current color but we don't know when the change will be made.
        // This problem is only related to Android, so on iOS it will be only set once.
        if (!CorePlatform.isAndroid()) {
            CoreApp.setSystemUIColors();

            return;
        }

        const promise = new CorePromisedValue<void>();

        const interval = window.setInterval(() => {
            CoreApp.setSystemUIColors();
        });
        setTimeout(() => {
            clearInterval(interval);
            promise.resolve();

        }, 1000);

        return promise;
    }

}