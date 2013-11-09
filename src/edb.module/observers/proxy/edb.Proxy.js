/*
var handler = {
	get: function ( target, name ) {
		return name in target ? target [ name ] : 37;
	},
	set : function ( target, name, value ) {
		target [ name ] = value;
		console.log ( "Hej" );
	}
};

var Test = gui.Class.create ( Object.prototype, {

	get : function ( target, name ) {
		return name in target ? target [ name ] : this [ name ];
	},

	set : function ( target, name, value ) {
		target [ name ] = value;
	},

	alarm : function () {
		console.log ( "Spasser" );
	},

	$onconstruct : function ( json ) {
		return new Proxy ( json, this );
	}
});

var test = new Test ({
	heil : 23,
	fiss : "fisse"
});
test.heil = 48;
console.log ( test.fiss );
test.alarm ();

edb.Handler = {
	get: function ( target, name ) {
		return name in target ? target [ name ] : 37;
	},
	set : function ( target, name, value ) {
		target [ name ] = value;
		console.log ( "Hej" );
	}
};

edb.Proxy = function ( target, handler ) {


};

*/