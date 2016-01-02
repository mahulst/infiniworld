angular.module('infiniworld')
.service("sStringGen", function($http, sRandomUtils) {
  var data = {};
  this.data = data;
  this.load = function(callback) {
    var sources = ["fantasyregion", "townnames", "pairednames",
                   "splats"];
    var pending = sources.length;
    angular.forEach(sources, function(source) {
      $http.get("data/" + source + ".json").then(function(r) {
        data[source] = r.data;
        pending -= 1;
        if (!pending) {
          callback();
        }
      });
    });
  };
  this.generate = function(source, name, key) {
    if (!this.data[source]) {
      console.debug(["ERROR", source, name, key]);
      return "ERROR"
    }
    return sRandomUtils.build(this.data[source], name, key);
  };
  this.townname = function(key) {
    var source;
    if (key < 0.5) {
      source = "townnames";
    } else {
      source = "pairednames";
    }
    key = 2 * key;
    return this.generate(source, "main", key);
  };
  this.fantasyregion = function(key) {
    return this.generate("fantasyregion", "main", key);
  };
  this.getNationDesc = function(key) {
    return this.generate("fantasyregion", "main_nation", key);
  };
  this.getNationFeatures = function(key) {
    var mashed = this.generate("fantasyregion", "features_nation", key)
    return mashed.split("<li>");
  };
  this.faction = function(key) {
    return this.generate("splats", "main", key);
  };
})
.service("sBasicFeatures", function(sField, sStringGen, sRandomUtils) {
  function makeFeature(featureId, getter) {
    var field = sField.simpleMap(featureId);
    return function(pos) {
      return getter(pos, field(pos.x, pos.y));
    }
  }
  
  // DATA, to isolate
  var NATIONKINDS = [
    "Kingdom", "Kingdom", "Empire", "Republic",
    "Kingdom", "Kingdom", "Empire", "Republic",
    "Confederacy", "Grand-duchy"
  ];
  var NATIONCITIES = {
    "Kingdom": ["A baronny", "A province", "A duchy"],
    "Empire": ["A province", "A region"],
    "Republic": ["A province"],
    "Confederacy": ["A city-state"],
    "Grand-duchy": ["A baronny"]
  };
  var NATIONRULERS = {
    "Kingdom": ["a baron", "a duke", "a council of nobles"],
    "Empire": ["a governor", "a consul", "a council", "a magistrate"],
    "Republic": ["a governor", "a mayor", "a council"],
    "Confederacy": ["a prince", "a council of nobles", "an archbishop"],
    "Grand-duchy": ["a magistrate", "a mayor"]
  };
  var COLOR_PAIRS = [
    ["red", "white"],
    ["red", "yellow"],
    ["red", "blue"],
    ["red", "black"],
    ["blue", "white"],
    ["blue", "black"],
    ["lightblue", "black"],
    ["blue", "yellow"],
    ["green", "white"],
    ["green", "yellow"],
    ["green", "black"],
    ["lightgreen", "black"],
    ["purple", "white"],
    ["purple", "black"],
    ["yellow", "black"],
    ["white", "black"],
    ["white", "blue"],
    ["grey", "blue"],
  ]
  var FLAG_PATTERNS = [
    "linear-gradient(to right, COLA, COLA 50%, COLB 50%, COLB)",
    "linear-gradient(to bottom, COLA, COLA 50%, COLB 50%, COLB)",
    "linear-gradient(to right, COLA, COLA 33%, COLB 33%, COLB 67%, COLA 67%, COLA)",
  ];


  // First isolate, then refactor.
  var kindKeyField = sField.simpleMap(711);
  var nameKeyField = sField.simpleMap(817);
  var colorKeyField = sField.simpleMap(17);

  this.getMainColor = function(key) {
    // Must be same logic as below!
    return sRandomUtils.pick(COLOR_PAIRS, key * 2)[0];
  }
  this.makeColors = function(key) {
    var colors = sRandomUtils.pick(COLOR_PAIRS, key * 2);
    var pattern = sRandomUtils.pick(FLAG_PATTERNS, key);
    var colA = colors[0];
    var colB = colors[1];
    if (sRandomUtils.flip(key*38)) {
      colA = colors[1];
      colB = colors[0];
    }
    return pattern.replace(/COLA/g, colA).replace(/COLB/g, colB);
  };
  this.makeNation = function(i, j) {
    var kind = sRandomUtils.pick(NATIONKINDS, kindKeyField(i, j));
    var basename = sStringGen.townname(nameKeyField(i, j));
    return {
      i: i,
      j: j,
      name: kind + " of " + basename,
      maincolor: this.getMainColor(colorKeyField(i, j)),
      colors: this.makeColors(colorKeyField(i, j)),
      getCityDescription: function(x, y) {
        var regionKind = sRandomUtils.pick(NATIONCITIES[kind],
          nameKeyField(x, y));
        return regionKind; // Basic, TODO: improve
      },
      getRulerDescription: function(x, y) {
        return sRandomUtils.pick(NATIONRULERS[kind], nameKeyField(x, y) * 7);
      },
    };
  };
})
.service("sCultures", function(sField, sStringGen, sRandomUtils, sBasicFeatures) {
  var RACES = [
    "Human", "Human", "Human", "Elf", "Elf", "Dwarf",
    "Orc", "Goblin"];
  var keyField = sField.simpleMap(43);
  var raceKeyField = sField.simpleMap(87);
  var INFLUENCE_RANGE = 2;
  this.getCulture = sField.memoize(function(i, j) {
    var culture = {};
    var key = keyField(i, j);
    if (key > 0.8) {
      // Nation! For now, simple.
      culture["nation"] = sBasicFeatures.makeNation(i, j);
      if (key > 0.85) {
        culture["race"] = sRandomUtils.pick(RACES, raceKeyField(i, j));
      }
    }
    else if (key > 0.6) {
      culture["race"] = sRandomUtils.pick(RACES, raceKeyField(i, j));
    } else if (key > 0.5) {
      culture["conspiracy"] = sStringGen.faction(raceKeyField(i, j));
    }
    // Also possible: religion, conspiracies, ancient empires
    culture.influence = 0.1 + key;
    return culture;
  });
  this.forEachCulture = function(pos, callback) {
    var i0 = Math.floor(pos.x / 8);
    var j0 = Math.floor(pos.y / 8);
    for (di = -INFLUENCE_RANGE; di <= INFLUENCE_RANGE; di++) {
      for (dj = -INFLUENCE_RANGE; dj <= INFLUENCE_RANGE; dj++) {
        var dist2 = di*di + dj*dj;
        callback(this.getCulture(i0 + di, j0 + dj), dist2);
      }
    }
  }
  this.getMostInfluent = function(pos, attribute) {
    var closestIDist = -1;
    var mostInfluent = null;
    this.forEachCulture(pos, function(culture, dist2) {
      if (culture[attribute]) {
        // This means even a culture with no influence will
        // win at dist = 0
        var iDist = dist2 / culture.influence;
        if ((iDist < closestIDist) || (closestIDist == -1)) {
          mostInfluent = culture[attribute];
        }
      }
    });
    return mostInfluent;
  }
  
  this.getNation = function(pos) {
    return this.getMostInfluent(pos, "nation");
    // If no nation, it'll be a city-state (nothing handles that yet)
  };
  this.getRace = function(pos) {
    return this.getMostInfluent(pos, "race");
  };
  this.getCityPopulation = function(pos) {
    // TODO: mention interesting groups
  };
  this.getCityFactions = function(pos) {
    // Who's up to what in a city?
    var factions = []
    this.forEachCulture(pos, function(culture, dist2) {
      // TODO: maybe sort/vary according to influence?
      if (culture.conspiracy) {
        factions.push(culture.conspiracy)
      }
    });
    return factions;
  }
})
.service("sFeatures", function(sField, sStringGen, sCultures) {
  function makeFeature(featureId, getter) {
    var field = sField.simpleMap(featureId);
    return function(pos) {
      return getter(pos, field(pos.x, pos.y));
    }
  }

  // Nation Features
  this.NATIONBLURB = makeFeature(811, function(pos, key) {
    return sStringGen.getNationDesc(key);
  });

  this.NATIONFEATURES = makeFeature(201, function(pos, key) {
    return sStringGen.getNationFeatures(key);
  });
  
  // City Features
  this.CITYNAME = makeFeature(117, function(pos, key) {
    return sStringGen.townname(key);
  });

  this.CITYBASICNATION = makeFeature(123, function(pos, key) {
    return sCultures.getNation(pos);
  });

  this.CITYRULER = makeFeature(119, function(pos, key) {
    var nation = sCultures.getNation(pos);
    return nation.getRulerDescription(pos.x, pos.y); 
  });
  
  this.CITYRACE = makeFeature(143, function(pos, key) {
    return sCultures.getRace(pos);
  });
  
  this.CITYBLURB = makeFeature(147, function(pos, key) {
    var nation = sCultures.getNation(pos);
    return nation.getCityDescription(pos.x, pos.y);
  });

  this.CITYFEATURES = makeFeature(149, function(pos, key) {
    return sStringGen.fantasyregion(key).split("<li>");
  });

  this.CITYFACTIONS = makeFeature(151, function(pos, key) {
    return sCultures.getCityFactions(pos);
  });
})
.service("sNations", function(sFeatures) {
  this.getDetailed = function(basicNation) {
    var pos = {x: basicNation.i, y: basicNation.j};
    return angular.extend({
      blurb:    sFeatures.NATIONBLURB(pos),
      features: sFeatures.NATIONFEATURES(pos),
    }, basicNation);
  };
})
.service("sCities", function(sFeatures) {
  var knownCities = {};
  // Used for world map
  this.getBasic = function(world, pos) {
    return {
      nation: sFeatures.CITYBASICNATION(pos),
      name: sFeatures.CITYNAME(pos),
    };
  };
  // Used for detailed view, when selected
  this.getDetailed = function(world, pos) {
    var posv = [pos.x, pos.y];
    if (!knownCities[posv]) {
      knownCities[posv] = angular.extend({
        race:     sFeatures.CITYRACE(pos),
        blurb:    sFeatures.CITYBLURB(pos),
        ruler:    sFeatures.CITYRULER(pos),
        features: sFeatures.CITYFEATURES(pos),
        factions: sFeatures.CITYFACTIONS(pos),
      }, this.getBasic(world, pos));
    }
    return knownCities[posv];
  };
});
