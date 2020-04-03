# Spree 2 Vue Storefront

![spree2vs hero image](./readme-assets/github-spree_vue_storefront_pwa.png)

## Introduction

This README provides guidance on how to build your own E-Commerce PWA apps using [Spree Commerce](https://github.com/spree/spree) and [Vue Storefront](https://github.com/DivanteLtd/vue-storefront).

Progressive Web Apps (PWA), [according to Google](https://web.dev/what-are-pwas/), let you build mobile-friendly user shopping experiences available to everyone through a web browser but enabling native app-ike silky smooth functionality. So the best of two worlds – web apps reach (100% of web users) and native mobile app-like UX.

Spree PWA is:
* **Reliable** – loads instantly even with a poor network connection or offline (for returning customers)
* **Fast** – responds quickly to user interactions with silky smooth animations and scrolling
* **Engaging** – feels like a native app on a mobile device which users can place permanently on their home screen
* **Cheaper** than a mobile app – because of the shared codebase between the website and the frontend app

Learn more about [Spree PWA here](https://spreecommerce.org/use-cases/spree-pwa-progressive-web-application/) and check out our Spree-powered PWA fashion demo: https://dofearnot.com/

## Demo

Visit the [Fearnot Demo Site][1] to test the platform and check how installing a web app works in practice.

![How to install PWA on iOS using Safari](https://github.com/spark-solutions/spree2vuestorefront/blob/master/readme-assets/pwa-installation-on-ios.png)

## Spree 2 Vue Storefront [spree2vs] overview

spree2vs bridges two open source initiatives into a complete e-commerce platform. It combines [Spree][3]'s inventory and order management capabilities with [Vue Storefront][4]'s modern approach to consumer online shopping experiences.

An increasingly influential feature of the platform is support for Progressive Web App ([PWA][2]) technologies. They allow *installing* a store's website on consumer devices and interacting with it just like with native apps. In this form, the store is listed among other apps for easier access and can utilize extra resources unlocked for it by the device. For example, it may retain more data on the phone to provide a faster and smoother product browsing experience. PWAs are supported on all major mobile and desktop operating systems.

## Architecture

Here's where spree2vs fits in the tech stack:

![where spree2vs fits in the stack](./readme-assets/tech-stack.png)

Part | Role 
---------|----------
Spree&nbsp;2&nbsp;Vue&nbsp;Storefront | Translates requests between Spree and Vue Storefront and imports information about products and categories from Spree to Elastic Search for consumption by Vue Storefront.
Spree | Manages products` catalog and orders. Is the "back office" portion of the tech stack. It makes sure products are available, orders can be placed, paid for and fulfilled.
Vue&nbsp;Storefront | Provides end user experience by serving an installable website. It's the "front office" of the stack.
Vue&nbsp;Storefront&nbsp;API | Normalizes communication between e-commerce stores (Spree) and the Vue Storefront front-end using standard REST endpoints. Converts requests from users of the website to Elastic Search queries and returns appropriate products for them. Also transfers information between spree2vs and the Vue Storefront website.

## Interface

To allow back and forth communication between the store and consumers, spree2vs provides a set of terminal commands.

### Importer Commands

Enable the synchronization of Spree's product catalog and categories with the Elastic Search database. It's the source for displaying products to consumers through the Vue Storefront front-end. VS can quickly search the catalog for certain products using fuzzy algorithms to increase the chances of returning expected results. Depending on the size of the store and the frequency of updates to the product catalog, synchronization between Spree and Elastic Search can happen a few or many times a day.

Commands:
- `create-indices` initializes Elastic Search
- `products` imports Spree products
- `categories` imports Spree categories
- `remove-everything` clears Elastic Search

### Updater Commands

Being able to view products is just part of what a complete e-commerce experience provides. The other responsibility of spree2vs is order management. Anything the user does with his order is immediately sent to Spree after being translated by spree2vs from user actions in the store. And if the user is offline, Vue Storefront will attempt to communicate with Spree the first chance it gets and send all previous actions he performed. Much of the website is cached to afford a more seamless experience regardless of the quality of the user's internet connection.

Commands:
- `api-server` starts a NodeJS server for updating orders in Spree


There's also a **diagnostic command**:
- `product [ids...]` retrieves details about specific products from Elastic Search

## Installation

### Production

Steps:

1. Create a `.env` file based on `.env.sample`.
1. `docker-compose -f docker-compose-prod.yml build`
1. `docker-compose -f docker-compose-prod.yml up`

The production image runs two processes simultaneously:
1. A HTTP server to handle user management (cart, order, etc.). It's restarted automatically on critical errors.
2. Scheduler which regularly imports the Spree catalog.

**Note:** The default host port is `8889`. When the `SERVER_PORT` env is unavailable, `PORT` is used instead.

### Development

Steps:

1. Add `127.0.0.1 host.docker.internal` to `/etc/hosts`.
1. Install NPM modules: `./bin/exec yarn install`.
1. Start a Webpack task which continuously rebuilds the project from source: `./bin/exec yarn watch`.
1. Setup Elastic Search to accept Spree records: `./bin/exec yarn create-indices`.
1. Import products, categories and attributes from Spree to the ES catalog: `./bin/exec yarn import:all`. In production mode, this script runs as a cron job at set intervals.
1. Run a Node server which allows order management in Spree by calling spree2vs endpoints: `./bin/exec yarn server`.

To remove the entire Elastic Search database: `./bin/exec yarn remove-everything`.

## Limitations

It's important to understand there are multiple parts required for the whole solution to work properly and spree2vs is one of them. spree2vs tries to make few assumptions about the tech stack. It supports a stock Spree installation and stock Vue Storefront. However, changes to VS's default theme may be required due to Spree's elaborate methods for handling shipping costs performed server-side.

Spree user account management by Vue Storefront is in development. This limitation can be overcome by using Spree's account management capabilities or adding support for Spree API v1 endpoints.


## Support

Join us on [slack.spreecommerce.org](http://slack.spreecommerce.org/), #spree-vue-frontend or create a new [GitHub Issue](https://github.com/spark-solutions/spree2vuestorefront/issues/new).

## License

spree2vs is released under the [New BSD License](https://github.com/spree/spree/blob/master/license.md).

## About Spark Solutions

[![Spark Solutions](./readme-assets/spark-solutions-logo.png)][spark]

spree2vs is maintained by [Spark Solutions Sp. z o.o.][spark].

We are passionate about open source software.
We are [available for hire][spark].

[1]: https://dofearnot.com/
[2]: https://developers.google.com/web/progressive-web-apps
[3]: https://spreecommerce.org/
[4]: [https://www.vuestorefront.io/]
[spark]:http://sparksolutions.co?utm_source=github
