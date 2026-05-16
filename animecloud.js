// AnimeCloud Provider for SkyStream
// Converted from CloudStream Kotlin extension by phisher98
// Source: fireani.me (German anime site)

const mainUrl = "https://fireani.me";

const commonHeaders = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": mainUrl + "/"
};

function getManifest() {
  return {
    name: "AnimeCloud",
    id: "com.phisher98.animecloud",
    version: 1,
    baseUrl: mainUrl,
    language: "de",
    type: "Anime"
  };
}

// Home page — fetches categories from the API
function getHome(callback) {
  var categories = [
    { path: "best-last-7d?page=1", label: "Trending" },
    { path: "genre?genere=Action&page=1", label: "Action" },
    { path: "genre?genere=Drama&page=1", label: "Drama" },
    { path: "genre?genere=Kom%C3%B6die&page=1", label: "Comedy" },
    { path: "genre?genere=Mystery&page=1", label: "Mystery" },
    { path: "genre?genere=Romanze&page=1", label: "Romanze" },
    { path: "genre?genere=Abenteuer&page=1", label: "Abenteuer" },
    { path: "genre?genere=EngSub&page=1", label: "EngSub" }
  ];

  var results = [];
  var completed = 0;

  categories.forEach(function(cat) {
    var url = mainUrl + "/api/animes/" + cat.path;
    http_get(url, commonHeaders, function(status, body) {
      try {
        var data = JSON.parse(body);
        var items = (data.data || []).map(function(item) {
          return {
            title: item.title,
            url: mainUrl + "/api/anime?slug=" + item.slug,
            posterUrl: mainUrl + "/img/posters/" + item.poster,
            type: "Anime"
          };
        });
        if (items.length > 0) {
          results.push({ title: cat.label, Data: items });
        }
      } catch (e) {}
      completed++;
      if (completed === categories.length) {
        callback(JSON.stringify(results));
      }
    });
  });
}

// Search
function search(query, callback) {
  var url = mainUrl + "/api/anime/search?q=" + encodeURIComponent(query);
  http_get(url, commonHeaders, function(status, body) {
    try {
      var data = JSON.parse(body);
      var results = (data.data || []).map(function(item) {
        return {
          title: item.title,
          url: mainUrl + "/api/anime?slug=" + item.slug,
          posterUrl: mainUrl + "/img/posters/" + item.poster,
          type: "Anime"
        };
      });
      callback(JSON.stringify(results));
    } catch (e) {
      callback(JSON.stringify([]));
    }
  });
}

// Load series details and episode list
function load(url, callback) {
  http_get(url, commonHeaders, function(status, body) {
    try {
      var data = JSON.parse(body);
      var doc = data.data;
      var title = doc.title || "Unknown";
      var poster = mainUrl + "/img/posters/" + doc.poster;
      var backdrop = mainUrl + "/img/posters/bg-" + doc.backdrop + ".webp";
      var description = doc.desc || "";
      var genres = doc.generes || [];
      var slug = url.split("slug=")[1];

      var episodes = [];
      (doc.anime_seasons || []).forEach(function(season) {
        var seasonNum = season.season;
        if (seasonNum.indexOf("Filme") !== -1) seasonNum = "0";

        (season.anime_episodes || []).forEach(function(ep) {
          var epNum = parseInt(ep.episode) || 0;
          var searchSeason = (seasonNum === "0") ? "Filme" : seasonNum;
          var epUrl = mainUrl + "/api/anime/episode?slug=" + slug +
                      "&season=" + encodeURIComponent(searchSeason) +
                      "&episode=" + epNum;

          episodes.push({
            name: "Episode " + epNum,
            url: epUrl,
            episode: epNum,
            season: parseInt(seasonNum) || 0,
            posterUrl: mainUrl + "/img/thumbs/" + (ep.image || "")
          });
        });
      });

      var result = {
        title: title,
        url: url,
        posterUrl: poster,
        backgroundPosterUrl: backdrop,
        description: description,
        tags: genres,
        type: "Anime",
        episodes: episodes
      };

      callback(JSON.stringify(result));
    } catch (e) {
      callback(JSON.stringify({ title: "Error", url: url, episodes: [] }));
    }
  });
}

// Load streams for an episode
function loadStreams(url, callback) {
  http_get(url, commonHeaders, function(status, body) {
    try {
      var data = JSON.parse(body);
      var links = (data.data && data.data.anime_episode_links) || [];
      var streams = [];

      var pending = links.length;
      if (pending === 0) {
        callback(JSON.stringify([]));
        return;
      }

      links.forEach(function(link) {
        var dubType = (link.lang || "").toUpperCase();
        var streamUrl = link.link || "";

        // Handle AnimeCloudProxy (fireani.me direct links)
        if (streamUrl.indexOf("fireani.me") !== -1) {
          var id = streamUrl.split("/").pop();
          var csrfUrl = streamUrl;
          http_get(csrfUrl, commonHeaders, function(s2, body2) {
            try {
              var csrfMatch = body2.match(/name=.csrftkn.\s+value=.([^"']+)/);
              var csrf = csrfMatch ? csrfMatch[1] : "";
              var sessionUrl = mainUrl + "/proxy/player/adehu1awmdxx?csrftkn=" + csrf;
              http_get(sessionUrl, commonHeaders, function(s3, body3) {
                var sessionMatch = body3.match(/session=([^;]+)/);
                var session = sessionMatch ? sessionMatch[1] : "";
                streams.push({
                  name: "AnimeCloud " + dubType,
                  url: mainUrl + "/proxy/nocache/" + id + "/",
                  headers: {
                    "Cookie": "session=" + session,
                    "Referer": mainUrl + "/"
                  }
                });
                pending--;
                if (pending === 0) callback(JSON.stringify(streams));
              });
            } catch (e) {
              pending--;
              if (pending === 0) callback(JSON.stringify(streams));
            }
          });
        }
        // Handle LuluStream (luluvdo.com)
        else if (streamUrl.indexOf("luluvdo.com") !== -1) {
          var filecode = streamUrl.split("/").pop();
          var postBody = "op=embed&file_code=" + filecode + "&auto=1&referer=" + encodeURIComponent(mainUrl);
          http_post("https://luluvdo.com/dl", commonHeaders, postBody, function(s2, body2) {
            try {
              var fileMatch = body2.match(/file:"([^"]+)"/);
              if (fileMatch) {
                streams.push({
                  name: "LuluStream " + dubType,
                  url: fileMatch[1],
                  headers: { "Referer": "https://luluvdo.com/" }
                });
              }
            } catch (e) {}
            pending--;
            if (pending === 0) callback(JSON.stringify(streams));
          });
        }
        // Fallback: pass URL directly
        else {
          streams.push({
            name: "AnimeCloud " + dubType,
            url: streamUrl,
            headers: commonHeaders
          });
          pending--;
          if (pending === 0) callback(JSON.stringify(streams));
        }
      });
    } catch (e) {
      callback(JSON.stringify([]));
    }
  });
}
