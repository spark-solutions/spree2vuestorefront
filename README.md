# Spree2VueStorefront

Intermediary layer for importing Spree catalogue and interacting with Spree. Placed between [Spree](http://spreecommerce.org) and [vue-storefront-api](https://github.com/DivanteLtd/vue-storefront-api).

## vue-storefront-api configuration (config/local.json)
```json
{
  "server": {
    "host": "localhost",
    "port": 8080,
    "searchEngine": "elasticsearch"
  },
  "orders": {
    "useServerQueue": false
  },
  "catalog": {
    "excludeDisabledProducts": false
  },
  "elasticsearch": {
    "host": "localhost",
    "port": 9200,
    "protocol": "http",
    "user": "elastic",
    "password": "changeme",
    "min_score": 0.01,
    "indices": [
      "vue_storefront_catalog",
      "vue_storefront_catalog_de",
      "vue_storefront_catalog_it"
    ],
    "indexTypes": [
      "product",
      "category",
      "cms",
      "attribute",
      "taxrule",
      "review"
    ]
  },
  "redis": {
    "host": "localhost",
    "port": 6379,
    "db": 0
  },
  "kue": {},
  "availableStores": [
    "de",
    "it"
  ],
  "storeViews": {
    "multistore": true,
    "mapStoreUrlsFor": [
      "de",
      "it"
    ],
    "de": {
      "storeCode": "de",
      "disabled": true,
      "storeId": 3,
      "name": "German Store",
      "url": "/de",
      "elasticsearch": {
        "host": "localhost:8080/api/catalog",
        "index": "vue_storefront_catalog_de"
      },
      "tax": {
        "defaultCountry": "DE",
        "defaultRegion": "",
        "calculateServerSide": false,
        "sourcePriceIncludesTax": true
      },
      "i18n": {
        "fullCountryName": "Germany",
        "fullLanguageName": "German",
        "defaultLanguage": "DE",
        "defaultCountry": "DE",
        "defaultLocale": "de-DE",
        "currencyCode": "EUR",
        "currencySign": "EUR",
        "dateFormat": "HH:mm D-M-YYYY"
      }
    },
    "it": {
      "storeCode": "it",
      "disabled": true,
      "storeId": 4,
      "name": "Italian Store",
      "url": "/it",
      "elasticsearch": {
        "host": "localhost:8080/api/catalog",
        "index": "vue_storefront_catalog_it"
      },
      "tax": {
        "defaultCountry": "IT",
        "defaultRegion": "",
        "calculateServerSide": false,
        "sourcePriceIncludesTax": true
      },
      "i18n": {
        "fullCountryName": "Italy",
        "fullLanguageName": "Italian",
        "defaultCountry": "IT",
        "defaultLanguage": "IT",
        "defaultLocale": "it-IT",
        "currencyCode": "EUR",
        "currencySign": "EUR",
        "dateFormat": "HH:mm D-M-YYYY"
      }
    }
  },
  "authHashSecret": "__SECRET_CHANGE_ME__",
  "objHashSecret": "__SECRET_CHANGE_ME__",
  "cart": {
    "setConfigurableProductOptions": false
  },
  "tax": {
    "defaultCountry": "US",
    "defaultRegion": "",
    "calculateServerSide": false,
    "alwaysSyncPlatformPricesOver": false,
    "usePlatformTotals": true,
    "setConfigurableProductOptions": true,
    "sourcePriceIncludesTax": true
  },
  "bodyLimit": "100kb",
  "corsHeaders": [
    "Link"
  ],
  "platform": "magento2",
  "registeredExtensions": [
    "mailchimp-subscribe",
    "example-magento-api",
    "cms-data",
    "mail-service"
  ],
  "extensions": {
    "mailchimp": {
      "listId": "e06875a7e1",
      "apiKey": "a9a3318ea7d30f5c5596bd4a78ae0985-us3",
      "apiUrl": "https://us3.api.mailchimp.com/3.0"
    },
    "mailService": {
      "transport": {
        "host": "smtp.gmail.com",
        "port": 465,
        "secure": true,
        "user": "vuestorefront",
        "pass": "vuestorefront.io"
      },
      "targetAddressWhitelist": [
        "contributors@vuestorefront.io"
      ],
      "secretString": "__THIS_IS_SO_SECRET__"
    }
  },
  "magento2": {
    "url": "http://demo-magento2.vuestorefront.io/",
    "imgUrl": "http://spree:3000",
    "assetPath": "/../var/magento2-sample-data/pub/media",
    "magentoUserName": "",
    "magentoUserPassword": "",
    "httpUserName": "",
    "httpUserPassword": "",
    "api": {
      "url": "http://demo-magento2.vuestorefront.io/rest",
      "consumerKey": "byv3730rhoulpopcq64don8ukb8lf2gq",
      "consumerSecret": "u9q4fcobv7vfx9td80oupa6uhexc27rb",
      "accessToken": "040xx3qy7s0j28o3q0exrfop579cy20m",
      "accessTokenSecret": "7qunl3p505rubmr7u1ijt7odyialnih9"
    }
  },
  "imageable": {
    "namespace": "",
    "maxListeners": 512,
    "imageSizeLimit": 1024,
    "whitelist": {
      "allowedHosts": [
        ".*divante.pl",
        ".*vuestorefront.io",
        "localhost",
        ".+"
      ]
    },
    "cache": {
      "memory": 50,
      "files": 20,
      "items": 100
    },
    "concurrency": 0,
    "counters": {
      "queue": 2,
      "process": 4
    },
    "simd": true,
    "keepDownloads": true
  },
  "entities": {
    "category": {
      "includeFields": [
        "children_data",
        "id",
        "children_count",
        "sku",
        "name",
        "is_active",
        "parent_id",
        "level",
        "url_key"
      ]
    },
    "attribute": {
      "includeFields": [
        "attribute_code",
        "id",
        "entity_type_id",
        "options",
        "default_value",
        "is_user_defined",
        "frontend_label",
        "attribute_id",
        "default_frontend_label",
        "is_visible_on_front",
        "is_visible",
        "is_comparable"
      ]
    },
    "productList": {
      "sort": "",
      "includeFields": [
        "type_id",
        "sku",
        "product_links",
        "tax_class_id",
        "special_price",
        "special_to_date",
        "special_from_date",
        "name",
        "price",
        "priceInclTax",
        "originalPriceInclTax",
        "originalPrice",
        "specialPriceInclTax",
        "id",
        "image",
        "sale",
        "new",
        "url_key"
      ],
      "excludeFields": [
        "configurable_children",
        "description",
        "configurable_options",
        "sgn"
      ]
    },
    "productListWithChildren": {
      "includeFields": [
        "type_id",
        "sku",
        "name",
        "tax_class_id",
        "special_price",
        "special_to_date",
        "special_from_date",
        "price",
        "priceInclTax",
        "originalPriceInclTax",
        "originalPrice",
        "specialPriceInclTax",
        "id",
        "image",
        "sale",
        "new",
        "configurable_children.image",
        "configurable_children.sku",
        "configurable_children.price",
        "configurable_children.special_price",
        "configurable_children.priceInclTax",
        "configurable_children.specialPriceInclTax",
        "configurable_children.originalPrice",
        "configurable_children.originalPriceInclTax",
        "configurable_children.color",
        "configurable_children.size",
        "product_links",
        "url_key"
      ],
      "excludeFields": [
        "description",
        "sgn"
      ]
    },
    "product": {
      "excludeFields": [
        "updated_at",
        "created_at",
        "attribute_set_id",
        "status",
        "visibility",
        "tier_prices",
        "options_container",
        "msrp_display_actual_price_type",
        "has_options",
        "stock.manage_stock",
        "stock.use_config_min_qty",
        "stock.use_config_notify_stock_qty",
        "stock.stock_id",
        "stock.use_config_backorders",
        "stock.use_config_enable_qty_inc",
        "stock.enable_qty_increments",
        "stock.use_config_manage_stock",
        "stock.use_config_min_sale_qty",
        "stock.notify_stock_qty",
        "stock.use_config_max_sale_qty",
        "stock.use_config_max_sale_qty",
        "stock.qty_increments",
        "small_image"
      ],
      "includeFields": null,
      "filterFieldMapping": {
        "category.name": "category.name.keyword"
      }
    }
  },
  "usePriceTiers": false,
  "boost": {
    "name": 3,
    "category.name": 1,
    "short_description": 1,
    "description": 1,
    "sku": 1,
    "configurable_children.sku": 1
  }
}

```

## vue-storefront configuration (config/local.json)

```json
{
  "server": {
    "host": "localhost",
    "port": 3000,
    "protocol": "http",
    "api": "api",
    "devServiceWorker": false,
    "useOutputCacheTagging": false,
    "useOutputCache": false,
    "outputCacheDefaultTtl": 86400,
    "availableCacheTags": [
      "product",
      "category",
      "home",
      "checkout",
      "page-not-found",
      "compare",
      "my-account",
      "P",
      "C",
      "error"
    ],
    "invalidateCacheKey": "aeSu7aip",
    "dynamicConfigReload": false,
    "dynamicConfigContinueOnError": false,
    "dynamicConfigExclude": [
      "ssr",
      "storeViews",
      "entities",
      "localForage",
      "shipping",
      "boost",
      "query"
    ],
    "dynamicConfigInclude": [],
    "elasticCacheQuota": 4096
  },
  "seo": {
    "useUrlDispatcher": false
  },
  "console": {
    "verbosityLevel": "only-errors"
  },
  "redis": {
    "host": "localhost",
    "port": 6379,
    "db": 0
  },
  "graphql": {
    "host": "localhost",
    "port": 8080
  },
  "elasticsearch": {
    "httpAuth": "",
    "host": "http://localhost:8080/api/catalog",
    "index": "vue_storefront_catalog",
    "min_score": 0.02,
    "csrTimeout": 5000,
    "ssrTimeout": 1000,
    "queryMethod": "GET",
    "disableLocalStorageQueriesCache": true
  },
  "ssr": {
    "templates": {
      "default": "dist/index.html",
      "minimal": "dist/index.minimal.html",
      "basic": "dist/index.basic.html",
      "amp": "dist/index.amp.html"
    },
    "executeMixedinAsyncData": true,
    "initialStateFilter": [
      "__DEMO_MODE__",
      "version",
      "storeView"
    ],
    "useInitialStateFilter": true
  },
  "defaultStoreCode": "",
  "storeViews": {
    "multistore": false,
    "mapStoreUrlsFor": [
      "de",
      "it"
    ],
    "de": {
      "storeCode": "de",
      "disabled": true,
      "storeId": 3,
      "name": "German Store",
      "url": "/de",
      "elasticsearch": {
        "host": "localhost:8080/api/catalog",
        "index": "vue_storefront_catalog_de"
      },
      "tax": {
        "sourcePriceIncludesTax": true,
        "defaultCountry": "DE",
        "defaultRegion": "",
        "calculateServerSide": true
      },
      "i18n": {
        "fullCountryName": "Germany",
        "fullLanguageName": "German",
        "defaultLanguage": "DE",
        "defaultCountry": "DE",
        "defaultLocale": "de-DE",
        "currencyCode": "EUR",
        "currencySign": "EUR",
        "dateFormat": "HH:mm D-M-YYYY"
      }
    },
    "it": {
      "storeCode": "it",
      "disabled": true,
      "storeId": 4,
      "name": "Italian Store",
      "url": "/it",
      "elasticsearch": {
        "host": "localhost:8080/api/catalog",
        "index": "vue_storefront_catalog_it"
      },
      "tax": {
        "sourcePriceIncludesTax": true,
        "defaultCountry": "IT",
        "defaultRegion": "",
        "calculateServerSide": true
      },
      "i18n": {
        "fullCountryName": "Italy",
        "fullLanguageName": "Italian",
        "defaultCountry": "IT",
        "defaultLanguage": "IT",
        "defaultLocale": "it-IT",
        "currencyCode": "EUR",
        "currencySign": "EUR",
        "dateFormat": "HH:mm D-M-YYYY"
      }
    }
  },
  "entities": {
    "optimize": true,
    "twoStageCaching": true,
    "optimizeShoppingCart": true,
    "category": {
      "includeFields": [
        "id",
        "*.children_data.id",
        "*.id",
        "children_count",
        "sku",
        "name",
        "is_active",
        "parent_id",
        "level",
        "url_key",
        "product_count",
        "path"
      ],
      "excludeFields": [
        "sgn"
      ],
      "categoriesRootCategorylId": 2,
      "categoriesDynamicPrefetchLevel": 2,
      "categoriesDynamicPrefetch": true
    },
    "attribute": {
      "includeFields": [
        "attribute_code",
        "id",
        "entity_type_id",
        "options",
        "default_value",
        "is_user_defined",
        "frontend_label",
        "attribute_id",
        "default_frontend_label",
        "is_visible_on_front",
        "is_visible",
        "is_comparable",
        "tier_prices",
        "frontend_input"
      ]
    },
    "productList": {
      "sort": "",
      "includeFields": [
        "type_id",
        "sku",
        "product_links",
        "tax_class_id",
        "special_price",
        "special_to_date",
        "special_from_date",
        "name",
        "price",
        "priceInclTax",
        "originalPriceInclTax",
        "originalPrice",
        "specialPriceInclTax",
        "id",
        "image",
        "sale",
        "new",
        "url_key",
        "status",
        "tier_prices",
        "configurable_children.sku",
        "configurable_children.price",
        "configurable_children.special_price",
        "configurable_children.priceInclTax",
        "configurable_children.specialPriceInclTax",
        "configurable_children.originalPrice",
        "configurable_children.originalPriceInclTax"
      ],
      "excludeFields": [
        "description",
        "configurable_options",
        "sgn",
        "*.sgn",
        "msrp_display_actual_price_type",
        "*.msrp_display_actual_price_type",
        "required_options"
      ]
    },
    "productListWithChildren": {
      "includeFields": [
        "type_id",
        "sku",
        "name",
        "tax_class_id",
        "special_price",
        "special_to_date",
        "special_from_date",
        "price",
        "priceInclTax",
        "originalPriceInclTax",
        "originalPrice",
        "specialPriceInclTax",
        "id",
        "image",
        "sale",
        "new",
        "configurable_children.image",
        "configurable_children.sku",
        "configurable_children.price",
        "configurable_children.special_price",
        "configurable_children.priceInclTax",
        "configurable_children.specialPriceInclTax",
        "configurable_children.originalPrice",
        "configurable_children.originalPriceInclTax",
        "configurable_children.color",
        "configurable_children.size",
        "configurable_children.id",
        "configurable_children.tier_prices",
        "product_links",
        "url_key",
        "status",
        "tier_prices"
      ],
      "excludeFields": [
        "description",
        "sgn",
        "*.sgn",
        "msrp_display_actual_price_type",
        "*.msrp_display_actual_price_type",
        "required_options"
      ]
    },
    "review": {
      "excludeFields": [
        "review_entity",
        "review_status"
      ]
    },
    "product": {
      "excludeFields": [
        "*.msrp_display_actual_price_type",
        "required_options",
        "updated_at",
        "created_at",
        "attribute_set_id",
        "options_container",
        "msrp_display_actual_price_type",
        "has_options",
        "stock.manage_stock",
        "stock.use_config_min_qty",
        "stock.use_config_notify_stock_qty",
        "stock.stock_id",
        "stock.use_config_backorders",
        "stock.use_config_enable_qty_inc",
        "stock.enable_qty_increments",
        "stock.use_config_manage_stock",
        "stock.use_config_min_sale_qty",
        "stock.notify_stock_qty",
        "stock.use_config_max_sale_qty",
        "stock.use_config_max_sale_qty",
        "stock.qty_increments",
        "small_image",
        "sgn",
        "*.sgn"
      ],
      "includeFields": null,
      "useDynamicAttributeLoader": true,
      "standardSystemFields": [
        "description",
        "configurable_options",
        "tsk",
        "custom_attributes",
        "size_options",
        "regular_price",
        "final_price",
        "price",
        "color_options",
        "id",
        "links",
        "gift_message_available",
        "category_ids",
        "sku",
        "stock",
        "image",
        "thumbnail",
        "visibility",
        "type_id",
        "tax_class_id",
        "media_gallery",
        "url_key",
        "max_price",
        "minimal_regular_price",
        "special_price",
        "minimal_price",
        "name",
        "configurable_children",
        "max_regular_price",
        "category",
        "status",
        "priceTax",
        "priceInclTax",
        "specialPriceTax",
        "specialPriceInclTax",
        "_score",
        "slug",
        "errors",
        "info",
        "erin_recommends",
        "special_from_date",
        "news_from_date",
        "custom_design_from",
        "originalPrice",
        "originalPriceInclTax",
        "parentSku",
        "options",
        "product_option",
        "qty",
        "is_configured"
      ]
    }
  },
  "cart": {
    "bypassCartLoaderForAuthorizedUsers": true,
    "multisiteCommonCart": true,
    "serverMergeByDefault": true,
    "serverSyncCanRemoveLocalItems": false,
    "serverSyncCanModifyLocalItems": false,
    "synchronize": true,
    "synchronize_totals": true,
    "setCustomProductOptions": true,
    "setConfigurableProductOptions": true,
    "askBeforeRemoveProduct": true,
    "create_endpoint": "http://localhost:8080/api/cart/create?token={{token}}",
    "updateitem_endpoint": "http://localhost:8080/api/cart/update?token={{token}}&cartId={{cartId}}",
    "deleteitem_endpoint": "http://localhost:8080/api/cart/delete?token={{token}}&cartId={{cartId}}",
    "pull_endpoint": "http://localhost:8080/api/cart/pull?token={{token}}&cartId={{cartId}}",
    "totals_endpoint": "http://localhost:8080/api/cart/totals?token={{token}}&cartId={{cartId}}",
    "paymentmethods_endpoint": "http://localhost:8080/api/cart/payment-methods?token={{token}}&cartId={{cartId}}",
    "shippingmethods_endpoint": "http://localhost:8080/api/cart/shipping-methods?token={{token}}&cartId={{cartId}}",
    "shippinginfo_endpoint": "http://localhost:8080/api/cart/shipping-information?token={{token}}&cartId={{cartId}}",
    "collecttotals_endpoint": "http://localhost:8080/api/cart/collect-totals?token={{token}}&cartId={{cartId}}",
    "deletecoupon_endpoint": "http://localhost:8080/api/cart/delete-coupon?token={{token}}&cartId={{cartId}}",
    "applycoupon_endpoint": "http://localhost:8080/api/cart/apply-coupon?token={{token}}&cartId={{cartId}}&coupon={{coupon}}"
  },
  "products": {
    "useShortCatalogUrls": false,
    "useMagentoUrlKeys": false,
    "setFirstVarianAsDefaultInURL": false,
    "configurableChildrenStockPrefetchStatic": false,
    "configurableChildrenStockPrefetchDynamic": false,
    "configurableChildrenStockPrefetchStaticPrefetchCount": 8,
    "filterUnavailableVariants": false,
    "listOutOfStockProducts": false,
    "preventConfigurableChildrenDirectAccess": true,
    "alwaysSyncPlatformPricesOver": false,
    "clearPricesBeforePlatformSync": false,
    "waitForPlatformSync": false,
    "setupVariantByAttributeCode": true,
    "endpoint": "http://localhost:8080/api/product",
    "defaultFilters": [
      "color",
      "size",
      "price",
      "erin_recommends"
    ],
    "filterFieldMapping": {
      "category.name": "category.name.keyword"
    },
    "colorMappings": {
      "Melange graphite": "#eeeeee"
    },
    "sortByAttributes": {
      "Latest": "updated_at",
      "Price: Low to high": "final_price",
      "Price: High to low": "final_price:desc"
    },
    "gallery": {
      "variantsGroupAttribute": "prodopt_2",
      "mergeConfigurableChildren": true,
      "imageAttributes": [
        "image",
        "thumbnail",
        "small_image"
      ],
      "width": 600,
      "height": 744
    },
    "filterAggregationSize": {
      "default": 10,
      "size": 10,
      "color": 10
    }
  },
  "orders": {
    "directBackendSync": true,
    "endpoint": "http://localhost:8080/api/order",
    "payment_methods_mapping": {},
    "offline_orders": {
      "automatic_transmission_enabled": false,
      "notification": {
        "enabled": true,
        "title": "Order waiting!",
        "message": "Click here to confirm the order that you made offline.",
        "icon": "/assets/logo.png"
      }
    }
  },
  "localForage": {
    "defaultDrivers": {
      "user": "LOCALSTORAGE",
      "cmspage": "LOCALSTORAGE",
      "cmsblock": "LOCALSTORAGE",
      "carts": "LOCALSTORAGE",
      "orders": "LOCALSTORAGE",
      "wishlist": "LOCALSTORAGE",
      "categories": "LOCALSTORAGE",
      "attributes": "LOCALSTORAGE",
      "products": "INDEXEDDB",
      "elasticCache": "LOCALSTORAGE",
      "claims": "LOCALSTORAGE",
      "syncTasks": "LOCALSTORAGE",
      "ordersHistory": "LOCALSTORAGE",
      "checkoutFieldValues": "LOCALSTORAGE"
    }
  },
  "reviews": {
    "create_endpoint": "http://localhost:8080/api/review/create?token={{token}}"
  },
  "users": {
    "autoRefreshTokens": true,
    "endpoint": "http://localhost:8080/api/user",
    "history_endpoint": "http://localhost:8080/api/user/order-history?token={{token}}",
    "resetPassword_endpoint": "http://localhost:8080/api/user/reset-password",
    "changePassword_endpoint": "http://localhost:8080/api/user/change-password?token={{token}}",
    "login_endpoint": "http://localhost:8080/api/user/login",
    "create_endpoint": "http://localhost:8080/api/user/create",
    "me_endpoint": "http://localhost:8080/api/user/me?token={{token}}",
    "refresh_endpoint": "http://localhost:8080/api/user/refresh"
  },
  "stock": {
    "synchronize": true,
    "allowOutOfStockInCart": true,
    "endpoint": "http://localhost:8080/api/stock"
  },
  "images": {
    "useExactUrlsNoProxy": false,
    "baseUrl": "http://localhost:8080/img/",
    "productPlaceholder": "/assets/placeholder.jpg"
  },
  "install": {
    "is_local_backend": true,
    "backend_dir": "../vue-storefront-api"
  },
  "demomode": false,
  "tax": {
    "defaultCountry": "PL",
    "defaultRegion": "",
    "sourcePriceIncludesTax": true,
    "calculateServerSide": true
  },
  "shipping": {
    "methods": [
      {
        "method_title": "DPD Courier",
        "method_code": "flatrate",
        "carrier_code": "flatrate",
        "amount": 4,
        "price_incl_tax": 5,
        "default": true,
        "offline": true
      }
    ]
  },
  "i18n": {
    "defaultCountry": "US",
    "defaultLanguage": "EN",
    "availableLocale": [
      "en-US",
      "de-DE",
      "fr-FR",
      "es-ES",
      "nl-NL",
      "jp-JP",
      "ru-RU",
      "it-IT",
      "pt-BR",
      "pl-PL",
      "cs-CZ"
    ],
    "defaultLocale": "en-US",
    "currencyCode": "USD",
    "currencySign": "$",
    "currencySignPlacement": "preppend",
    "dateFormat": "HH:mm D/M/YYYY",
    "fullCountryName": "United States",
    "fullLanguageName": "English",
    "bundleAllStoreviewLanguages": true
  },
  "mailchimp": {
    "endpoint": "http://localhost:8080/api/ext/mailchimp-subscribe/subscribe"
  },
  "mailer": {
    "endpoint": {
      "send": "http://localhost:8080/api/ext/mail-service/send-email",
      "token": "http://localhost:8080/api/ext/mail-service/get-token"
    },
    "contactAddress": "contributors@vuestorefront.io",
    "sendConfirmation": true
  },
  "theme": "@vue-storefront/theme-default",
  "analytics": {
    "id": false
  },
  "cms": {
    "endpoint": "http://localhost:8080/api/ext/cms-data/cms{{type}}/{{cmsId}}",
    "endpointIdentifier": "http://localhost:8080/api/ext/cms-data/cms{{type}}Identifier/{{cmsIdentifier}}/storeId/{{storeId}}"
  },
  "cms_block": {
    "max_count": 500
  },
  "cms_page": {
    "max_count": 500
  },
  "usePriceTiers": false,
  "boost": {
    "name": 3,
    "category.name": 1,
    "short_description": 1,
    "description": 1,
    "sku": 1,
    "configurable_children.sku": 1
  },
  "query": {
    "inspirations": {
      "filter": [
        {
          "key": "category.name",
          "value": {
            "eq": "Performance Fabrics"
          }
        }
      ]
    },
    "newProducts": {
      "filter": [
        {
          "key": "category.name",
          "value": {
            "eq": "Tees"
          }
        }
      ]
    },
    "coolBags": {
      "filter": [
        {
          "key": "category.name",
          "value": {
            "eq": "Women"
          }
        }
      ]
    },
    "bestSellers": {
      "filter": [
        {
          "key": "category.name",
          "value": {
            "eq": "Tees"
          }
        }
      ]
    }
  }
}
```

## Full `attribute` record in Elastic Search example
```js
{
  entity_type_id: 4,
  attribute_code: 'sssomeattributecodehere',
  attribute_model: null,
  backend_model: null,
  backend_type: 'int',
  backend_table: null,
  frontend_model: null,
  frontend_input: 'multiselect',
  frontend_label: 'ASDASashdgahsdg',
  frontend_class: null,
  source_model: 'eav/entity_attribute_source_table',
  is_required: false,
  is_user_defined: true,
  default_value: '',
  is_unique: false,
  note: null,
  attribute_id: 194,
  frontend_input_renderer: null,
  is_global: true,
  is_visible: true,
  is_searchable: true,
  is_filterable: true,
  is_comparable: false,
  is_visible_on_front: true,
  is_html_allowed_on_front: true,
  is_used_for_price_rules: false,
  is_filterable_in_search: false,
  used_in_product_listing: 0,
  used_for_sort_by: 0,
  is_configurable: true,
  apply_to: 'simple,grouped,configurable',
  is_visible_in_advanced_search: true,
  position: 0,
  is_wysiwyg_enabled: true,
  is_used_for_promo_rules: true,
  search_weight: 1,
  id: 123,
    attribute_code: 'abc',
    default_frontend_label: 'Eco Collection',
  default_value: '',
    id: 123,
  entity_type_id: 4,
    is_user_defined: true,
    is_visible: true,
    is_visible_on_front: true,
  frontend_input: 'select',
  frontend_label: 'ASDASashdgahsdg',
  attribute_id: 123,
    options: [
      {
        label: 'SSS',
        value: '123'
      },
      {
        label: 'SASDAsdSS',
        value: 'someattrvalue123'
      }
    ]
  },
  id: 123,
  index: 'vue_storefront_catalog',
  type: 'attribute'
}
```

## TODOS

TODO: how to translate custom attributes' labels in VS?

TODO: add support for promotions from Spree

TODO: add support for discontinue and available dates from Spree

TODO: how to handle currently set for specific product in Spree?

TODO: how to handle shipping category from Spree?

TODO: use product tags from Spree

TODO: optimize importing resources to Elastic Search - use `bulk` method (https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-bulk.html)

TODO: why does the gallery not switch to image of variant when variant selected?

## Spree notes
- If a Spree product has variants, the `default_variant` references one of the variants. Otherwise, `default_variant` contains the product information.
- When a new option type is added to a product, existing variants won't show it in the front-end, because they don't have a value set for it and there's no default picked by Spree.

## VS and VS-api notes
- If `attribute` record is provided without `frontend_input`, then the value from `product` record will be printed after applying `.toString()` on it.
- `type_id` in ES products usually equals `"configurable"`. The other option is `simple`. `"configurable"` is required when:
  - product has options
  - product has variants
- Effects of using `type_id: "configurable"`:
  - product variants must be a list (can be empty)
- The only fields required for custom attributes are: `attribute_code`, `is_user_defined=true`, `is_visible_on_front=true` and `is_visible=true`.
- `configurable_options` in a product is not required if variants cannot be selected with options.

## VS and VS-api bugs/limitations
- Can't show incomplete variants (not all option combinations covered).
- Each variant can only have a single extra image. It's added to the product's gallery.
- When a product doesn't have variants, refreshing the website on a product page redirects to `/not_found`
- In default Spree, only images of currently selected product variant are visible at one time. In VS, the images from all variants are merged into a single gallery.
- VS doesn't support an order key for options or option values. So instead arrays of options and option values should be ordered before being imported to Elastic Search.
- Bug: setting attributes for a product inside `custom_attributes` is completely ignored when `useDynamicAttributeLoader: true` in VS configuration. `custom_attributes` are pushed onto product anyway, so it doesn't have to be used.

References:
- [https://github.com/DivanteLtd/vue-storefront-integration-boilerplate/blob/master/3.%20Configure%20vue-storefront/How%20to%20configure%20Vue%20Storefront.md](https://github.com/DivanteLtd/vue-storefront-integration-boilerplate/blob/master/3.%20Configure%20vue-storefront/How%20to%20configure%20Vue%20Storefront.md)
- [https://github.com/DivanteLtd/vue-storefront-integration-boilerplate](https://github.com/DivanteLtd/vue-storefront-integration-boilerplate)
- [https://github.com/DivanteLtd/bigcommerce2vuestorefront](https://github.com/DivanteLtd/bigcommerce2vuestorefront)
- [https://github.com/DivanteLtd/vue-storefront/blob/master/docs/guide/basics/configuration.md](https://github.com/DivanteLtd/vue-storefront/blob/master/docs/guide/basics/configuration.md)
- [vue-storefront-api/src/graphql/elasticsearch/catalog/schema.graphqls](vue-storefront-api/src/graphql/elasticsearch/catalog/schema.graphqls)
- if some key/value pair in VS or VS-api seems weird, search Magento docs