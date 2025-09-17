import fs from "fs";

const OPT_IN_SHEET_URL =
  "https://main--commerce-feeds--aemsites.aem.live/oai-feeds.json?sheet=opt-in-customers";

const CODE_CONFIG = {
  owner: "aemsites",
  repo: "catalog-service-feed",
  source: {
    type: "github",
    url: "https://github.com/aemsites/catalog-service-feed",
  },
};

const CONTENT_CONFIG = {
  contentBusId: "78b2535581512307e3625982752beb58d2b143124d8923c80cbe6cd5b37",
  source: {
    url: "https://drive.google.com/drive/u/0/folders/1MGzOt7ubUh3gu7zhZIPb7R7dyRzG371j",
    type: "google",
    id: "1MGzOt7ubUh3gu7zhZIPb7R7dyRzG371j",
  },
};

const PIPELINE_PATTERNS_CONFIG = {
  base: {
    storeViewCode: "default",
    storeCode: "main",
  },
};

const MIXER_CONFIG = {
  patterns: {
    // insert any base patterns not from opt in
  },
  backends: {
    adobe_productbus: {
      origin: "pipeline-cloudflare.adobecommerce.live",
      path: "/aemsites/catalog-service-feed/main/",
    },
  },
};

const pipelinePatternEntry = (record = {}) => {
  const { customerId, storeCode, storeViewCode } = record;
  return {
    [`/${customerId}/{% raw %}{{urlKey}}{% endraw %}`]: {
      pageType: "product",
      storeCode,
      storeViewCode,
    },
  };
};

const mixerPatternEntry = (record) => {
  const { customerId } = record;
  return {
    [`/${customerId}/*`]: "adobe_productbus",
  };
};

const prepareRecord = (record) => {
  const {
    ["Product Bus Customer Id"]: customerId,
    ["Product Bus Sitekey"]: siteKey,
    ["Opt-In Date"]: optInDate,
  } = record;
  if (!siteKey || !customerId) {
    console.info("skipping invalid record", record);
    return null;
  }

  const [owner, site, storeCode, storeViewCode] = siteKey.split("/");
  if (!owner || !site || !storeCode || !storeViewCode) {
    console.info("skipping invalid record, invalid site key: ", siteKey);
    return null;
  }

  return {
    optInDate,
    customerId,
    siteKey,
    owner,
    site,
    storeCode,
    storeViewCode,
  };
};

(async () => {
  const res = await fetch(OPT_IN_SHEET_URL);
  const data = await res.json();

  const records = data.data.map(prepareRecord);
  const mixerPatterns = records.map(mixerPatternEntry).reduce((rec, acc) => {
    Object.keys(rec).forEach((key) => {
      acc[key] = rec[key];
    });
    return acc;
  }, {});
  const pipelinePatterns = records
    .map(pipelinePatternEntry)
    .reduce((rec, acc) => {
      Object.keys(rec).forEach((key) => {
        acc[key] = rec[key];
      });
      return acc;
    }, {});

  const config = {
    code: CODE_CONFIG,
    content: CONTENT_CONFIG,
    public: {
      patterns: {
        ...PIPELINE_PATTERNS_CONFIG,
        ...pipelinePatterns,
      },
      mixerConfig: {
        patterns: {
          ...MIXER_CONFIG.patterns,
          ...mixerPatterns,
        },
        backends: {
          ...MIXER_CONFIG.backends,
        },
      },
    },
  };

  fs.writeFileSync("aem-config.json", JSON.stringify(config, null, 2));
})();
