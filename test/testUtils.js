if (typeof String.prototype.startsWith != 'function') {
  String.prototype.startsWith = function (str){
    return this.slice(0, str.length) == str;
  };
}

if (typeof String.prototype.endsWith != 'function') {
  String.prototype.endsWith = function (str){
    return this.slice(-str.length) == str;
  };
}
var testUtils = function testUtils(){
	var csrf;
	var apiKey;
	var isLoggedIn = false;
	var that = this;
	var props = {};
	var RE = /^-{0,1}\d*\.{0,1}\d+$/;
	
	this.url = "http://localhost";
	this.name = "Test Test";
	this.username = "test";
	this.password = "test";
	this.email = "test@domain.com";
 
    this.setCSRF = function(token){
        csrf = token;
    };
	
	this.CSRFfromBody = function(body){
		//var rePattern = new RegExp(/countlyGlobal\["csrf_token"\] = "([^"]*)";/);
        var rePattern = new RegExp(/value="([^"]*)" name="_csrf"/);
		var arrMatches = body.match(rePattern);
		csrf = arrMatches[1];
		return csrf;
    };
	
	this.getCSRF = function(){
		return csrf;
	};
 
    this.waitCSRF = function(done){
        if (csrf) done();
		else setTimeout( function(){ that.waitCSRF(done) }, 1000 );
    };
	
	this.getApiKey = function(agent){
		agent
		.get('/api-key')
		.auth(this.username, this.password)
		.end(function(err, res){
			apiKey = res.text;
		});
	};
	
	this.waitApiKey = function(done){
        if (apiKey) done();
		else setTimeout( function(){ that.waitApiKey(done) }, 1000 );
    };
	
	this.login = function(agent){
		agent
		.get('/login')
		.expect('Content-Type', "text/html; charset=utf-8")
		.expect(200)
		.end(function(err, res){
			that.CSRFfromBody(res.text);
			//bug in superagent not saving cookies before callback
			process.nextTick(function () {
				agent
				.post('/login')
				.send({username:that.username, password:that.password, _csrf:that.getCSRF()})
				.expect('location', '/dashboard')
				.expect(302)
				.end(function(err, res){
					isLoggedIn = true;
				});
			}); 
		});
	};
	
	this.waitLogin = function(done){
        if (isLoggedIn) done();
		else setTimeout( function(){ that.waitLogin(done) }, 1000 );
    };
	
	this.waitParsing = function(done){
        if (isParsed) done();
		else setTimeout( function(){ that.waitParsing(done) }, 1000 );
    };
	
	this.getLinkType = function(link){
		if(link.endsWith(".js"))
			return "application/javascript";
		else if(link.endsWith(".css"))
			return "text/css; charset=UTF-8";
		else if(link.endsWith(".png"))
			return "image/png";
		return "text/html; charset=utf-8";
	};
	
	this.processLink = function(rePattern, body){
		var matches = [], found, link;
		while (found = rePattern.exec(body)) {
			link = found[1];
			//remove query string
			link = link.split("?")[0];
			if(link.startsWith(this.url) || (!link.startsWith("http") && !link.startsWith("//") && !link.startsWith("mailto:") && !link.startsWith("#") && !link.startsWith("/logout")))
				matches.push(link);
		}
		return matches;
	}
	
	this.parseLinks = function(body){
		var matches = [];
		matches = matches.concat(this.processLink(new RegExp(/href="([^"]*)"/g), body));
		matches = matches.concat(this.processLink(new RegExp(/href='([^']*)'/g), body));
		matches = matches.concat(this.processLink(new RegExp(/src="([^"]*)"/g), body));
		matches = matches.concat(this.processLink(new RegExp(/src='([^']*)'/g), body));
		return matches
	};
	
	this.get = function(key){
		return props[key];
	};
	
	this.set = function(key, val){
		props[key] = val;
	};
	
	this.validateSessionData = function(err, res, done, correct){
		if (err) return done(err);
		var ob = JSON.parse(res.text);
		ob.should.not.be.empty;
		ob.should.have.property("meta", correct.meta);
		//ob.should.have.property("meta", {"countries":["Unknown"],"f-ranges":["0"],"l-ranges":["0"]});
		for(i in ob)
		{
			ob.should.have.property(i).and.not.eql({});
			if(RE.test(i))
			{
				for(var c in correct){
					if(c == "Unknown")
						ob[i].should.have.property(c, {"u":correct.u,"t":correct.t,"n":correct.n});
					else if(c != "meta")
						ob[i].should.have.property(c, correct[c]);
				}
				for(j in ob[i])
				{
					if(RE.test(j))
					{
						for(var c in correct){
							if(c == "Unknown")
								ob[i][j].should.have.property(c, {"u":correct.u,"t":correct.t,"n":correct.n});
							else if(c != "meta")
								ob[i][j].should.have.property(c, correct[c]);
						}
						for(k in ob[i][j])
						{
							if(RE.test(k))
							{
								for(var c in correct){
									if(c == "Unknown")
										ob[i][j][k].should.have.property(c, {"u":correct.u,"t":correct.t,"n":correct.n});
									else if(c != "meta")
										ob[i][j][k].should.have.property(c, correct[c]);
								}
							}
						}
					}
					else if(j.indexOf("w") == 0){
						var w = {};
						if(correct.u)
							w["u"] = correct.u;
						if(correct.f)
							w["f"] = correct.f;
						if(correct.l)
							w["l"] = correct.l;
						if(correct.ds)
							w["ds"] = correct.ds;
						if(correct.p)
							w["p"] = correct.p;
						if(correct.Unknown)
							w["Unknown"] = {"u":correct.u};
						ob[i].should.have.property(j, w);
					}
				}
			}
		}
		setTimeout(done, 1000)
	};
	
	this.validateDashboard = function(err, res, done, correct){
		function compare(a,b) {
			if (a.last_nom < b.last_nom)
				return -1;
			if (a.last_nom > b.last_nom)
				return 1;
			return 0;
		}
		if (err) return done(err);
		var ob = JSON.parse(res.text);
		var props = ['30days', '7days', 'today'];
		var prop;
		for(var i = 0; i < props.length; i++){
			prop = props[i];
			ob.should.have.property(prop);
			var period = ob[prop];
			period.should.have.property("dashboard");
			var dashboard = period["dashboard"];
			dashboard.should.have.property("total_sessions", {"total":correct.total_sessions,"change":"NA", "trend":"u"});
			if(prop == "today")
				dashboard.should.have.property("total_users", {"total":correct.total_users,"change":"NA","trend":"u","is_estimate":false});
			else
				dashboard.should.have.property("total_users", {"total":correct.total_users,"change":"NA","trend":"u","is_estimate":true});
			dashboard.should.have.property("new_users", {"total":correct.new_users,"change":"NA","trend":"u"});
			dashboard.should.have.property("total_time",{"total":correct.total_time,"change":"NA","trend":"u"});
			dashboard.should.have.property("avg_time", {"total":correct.avg_time,"change":"NA","trend":"u"});
			dashboard.should.have.property("avg_requests", {"total":correct.avg_requests,"change":"NA","trend":"u"});
			period.should.have.property("top");
			var top = period["top"];
			top.platforms.sort();
			top.resolutions.sort();
			top.carriers.sort();
			top.should.have.property("platforms", correct.platforms.sort(compare));
			top.should.have.property("resolutions", correct.resolutions.sort(compare));
			top.should.have.property("carriers", correct.carriers.sort(compare));
			top.should.have.property("users");
			period.should.have.property("period");
		}
		
		setTimeout(done, 1000);
	};
	
	this.validateCountries = function(err, res, done, correct){
		if (err) return done(err);
		var ob = JSON.parse(res.text);
		ob.should.not.be.empty;
		var props = ['30days', '7days', 'today'];
		var key;
		for(var j = 0; j < props.length; j++){
			key = props[j];
			ob.should.have.property(key).and.not.empty;
			for(var i = ob[key].length-1; i >= 0; i--){
				ob[key][i].should.have.property("country", correct.country);
				ob[key][i].should.have.property("code", correct.code);
				ob[key][i].should.have.property("t", correct.t);
				if(key == "today")
					ob[key][i].should.have.property("u", correct.u);
				else
					ob[key][i].should.have.property("u", correct.u2);
				ob[key][i].should.have.property("n", correct.n);
			}
		}
		setTimeout(done, 1000)
	};
	
	this.validateMetrics = function(err, res, done, correct){
		if (err) return done(err);
		var ob = JSON.parse(res.text);
		ob.should.not.be.empty;
		if(ob["meta"]){
			for(var i in ob["meta"])
				ob["meta"][i].sort()
		}
		if(correct["meta"]){
			for(var i in correct["meta"])
				correct["meta"][i].sort()
		}
		ob.should.have.property("meta").eql(correct.meta);
		for(i in ob)
		{
			ob.should.have.property(i).and.not.eql({});
			if(RE.test(i))
			{
				for(var c in correct){
					if(c != "meta")
						ob[i].should.have.property(c, correct[c]);
				}
				for(j in ob[i])
				{
					if(RE.test(j))
					{
						for(var c in correct){
							if(c != "meta")
								ob[i][j].should.have.property(c, correct[c]);
						}
						for(k in ob[i][j])
						{
							if(RE.test(k))
							{
								for(var c in correct){
									if(c != "meta")
										ob[i][j][k].should.have.property(c, correct[c]);
								}
							}
						}
					}
					else if(j.indexOf("w") == 0){
						var w = {};
						for(var c in correct){
							if(c != "meta")
								w[c] = {u:correct[c].u};
						}
						ob[i].should.have.property(j, w);
					}
				}
			}
		}
		setTimeout(done, 1000);
	};
	
	this.validateEvents = function(err, res, done, correct, refresh){
		if (err) return done(err);
		var ob = JSON.parse(res.text);
		ob.should.not.be.empty;
		if(correct.meta){
			for(var i in ob.meta){
				ob.meta[i].sort();
			}
			ob.should.have.property("meta", correct.meta);
		}
		for(i in ob)
		{
			ob.should.have.property(i).and.not.eql({});
			if(RE.test(i))
			{
				if(!refresh)
					for(var c in correct){
						if(c != "meta")
							ob[i].should.have.property(c, correct[c]);
					}
				for(j in ob[i])
				{
					if(RE.test(j))
					{
						if(!refresh)
							for(var c in correct){
								if(c != "meta")
									ob[i][j].should.have.property(c, correct[c]);
							}
						for(k in ob[i][j])
						{
							if(RE.test(k))
							{
								for(var c in correct){
									if(c != "meta")
										ob[i][j][k].should.have.property(c, correct[c]);
								}
								for(n in ob[i][j][k])
								{
									if(RE.test(n))
									{
										for(var c in correct){
											if(c != "meta")
												ob[i][j][k][n].should.have.property(c, correct[c]);
										}
									}
								}
							}
						}
					}
				}
			}
		}
		setTimeout(done, 1000)
	};
}

module.exports = new testUtils();