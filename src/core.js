(function (root) {
  "use strict";

  function ethereumAddress(value) {
    var address = typeof value === "string" ? value.trim() : "";
    return /^0x[0-9a-fA-F]{40}$/.test(address) && !/^0x0{40}$/i.test(address) ? address : "";
  }

  function httpsUrl(value, hosts) {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
      var url = new URL(value.trim());
      if (url.protocol !== "https:" || url.username || url.password) return "";
      if (hosts && !hosts.includes(url.hostname.toLowerCase())) return "";
      return url.href;
    } catch (_) {
      return "";
    }
  }

  function normalizeConfig(input) {
    var source = input && typeof input === "object" ? input : {};
    var links = source.links && typeof source.links === "object" ? source.links : {};
    var address = ethereumAddress(source.contractAddress);
    var pair = ethereumAddress(source.pairAddress);
    var chart = httpsUrl(links.chart, ["dexscreener.com", "www.dexscreener.com", "www.dextools.io", "dextools.io"]);
    var x = httpsUrl(links.x, ["x.com", "www.x.com", "twitter.com", "www.twitter.com"]);
    var telegram = httpsUrl(links.telegram, ["t.me", "telegram.me", "www.t.me"]);
    var buy = address ? httpsUrl(links.buy) : "";
    if (!chart && pair && address) chart = "https://dexscreener.com/ethereum/" + pair;
    if (!address) chart = "";
    return Object.freeze({
      name: "Wildwood, Odd One in",
      ticker: "WOOI",
      network: "Ethereum",
      chainId: 1,
      address: address,
      pair: pair,
      siteUrl: httpsUrl(source.siteUrl),
      buy: buy,
      chart: chart,
      x: x,
      telegram: telegram,
      explorer: address ? "https://etherscan.io/token/" + address : "",
      embed: address && pair
        ? "https://dexscreener.com/ethereum/" + pair + "?embed=1&theme=dark&info=0&trades=0"
        : ""
    });
  }

  root.WOOI_CORE = Object.freeze({
    ethereumAddress: ethereumAddress,
    httpsUrl: httpsUrl,
    normalizeConfig: normalizeConfig
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
