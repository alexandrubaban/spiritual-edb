/**
 * Tracking EDB input.
 * @extends {gui.Tracker}
 */
edb.InputPlugin = gui.Tracker.extend ( "edb.InputPlugin", {
   
	/**
	 * True when one of each expected input type has been collected.
	 * @type {boolean}
	 */
	done : true,
	
	/**
	 * Construction time.
	 * @overloads {gui.Tracker#construct}
	 */
	onconstruct : function () {
		this._super.onconstruct ();
		gui.Broadcast.addGlobal ( gui.BROADCAST_OUTPUT, this );
		this._watches = [];
		this._matches = [];
	},
	
	/**
	 * Add handler for one or more input types.
	 * @param {edb.Type|String|Array<edb.Type|String>} arg
	 * @param @optional {object} IInputHandler Defaults to this.spirit
	 * @returns {gui.InputPlugin}
	 */
	add : gui.Combo.chained ( function ( arg, handler ) {
		this.done = false;
		handler = handler ? handler : this.spirit;
		arg = edb.InputPlugin._breakdown ( arg, this.context );
		this._add ( arg, handler );
	}),

	/**
	 * Remove handler for one or more input types.
	 * @TODO Cleanup more stuff?
	 * @param {object} arg
	 * @param @optional {object} handler implements InputListener (defaults to this)
	 * @returns {gui.InputPlugin}
	 */
	remove : gui.Combo.chained ( function ( arg, handler ) {
		handler = handler ? handler : this.spirit;
		arg = edb.InputPlugin._breakdown ( arg, this.context );
		this._remove ( arg, handler );
		this.done = this._matches.length === this._watches.length;
	}),

	/**
	 * Get data for latest input of type (or best match).
	 * @TODO Safeguard somewhat
	 * @param {function} type
	 * @returns {object}
	 */
	get : function ( type ) {
		var types = this._matches.map ( function ( input ) {
			return input.data.constructor;
		});
		var best = edb.InputPlugin._bestmatch ( type, types );
		var input = best ? this._matches.filter ( function ( input ) {
			return input.type === best;
		}).shift () : null;
		return input ? input.data : null;
	},
	
	/**
	 * Evaluate new input.
	 * @param {gui.Broadcast} b
	 */
	onbroadcast : function ( b ) {
		if ( b.type === gui.BROADCAST_OUTPUT ) {
			this._maybeinput ( b.data );
		}
	},
	
	
	// PRIVATES .........................................................................................
	
	/**
	 * Expecting instances of these types (or best match).
	 * @type {Array<function>}
	 */
	_watches : null,

	/**
	 * Latest (best) matches, one of each expected type.
	 * @type {Array<edb.Input>} 
	 */
	_matches : null,

	/**
	 * Add input handler for types.
	 * @TODO Are we sure that tick works synch in all browsers 
	 * (FF)? If not, better to wait for this.spirit.life.ready
	 * @param {Array<function>} types
	 * @param {IInputHandler} handler
	 */
	_add : function ( types, handler ) {
		types.forEach ( function ( type ) {
			this._watches.push ( type );
			this._addchecks ( type.$classid, [ handler ]);
			if ( type.output ) { // type has been output already?
				gui.Tick.next(function(){ // allow nested {edb.ScriptSpirit} to spiritualize first
					this._todoname ();
				}, this );
			}
		}, this );
	},

	/**
	 * Remove input handler for types.
	 * @param {Array<function>} types
	 * @param {IInputHandler} handler
	 */
	_remove : function ( types, handler ) {
		types.forEach ( function ( type ) {
			var index = this._watches.indexOf ( type );
			if ( index >-1 ) {
				this._watches.remove ( index );
				this._removechecks ( type.$classid, [ handler ]);
			}
		}, this );
	},

	/*
	 * Collect all types before evaluating this.done; make sure 
	 * that all required types are served in a single array, 
	 * otherwise script.run () may be invoked prematurely.
	 * TODO: Update the above to reflect modern API
	 */
	_todoname : function () {
		this._watches.forEach ( function ( type ) {
			if ( type.output instanceof edb.Input ) {
				this._maybeinput ( type.output );
			}
		}, this );
	},

	/**
	 * If input matches registered type, update handlers.
	 * @param {edb.Input} input
	 */
	_maybeinput : function ( input ) {
		var best = edb.InputPlugin._bestmatch ( input.type, this._watches );
		if ( best ) {
			this._updatematch ( input );
			this.done = this._matches.length === this._watches.length;
			this._updatehandlers ( input );
		}
	},

	/**
	 * Register match for type (remove old match if any).
	 * @param {edb.Input} input
	 * @param {function} best
	 */
	_updatematch : function ( newinput, newbest ) {
		var matches = this._matches;
		var types = matches.map ( function ( input ) {
			return input.type;
		});
		var best = edb.InputPlugin._bestmatch ( newinput.type, types );
		if ( best ) {
			var oldinput = matches.filter ( function ( input ) {
				return input.type === best;
			})[ 0 ];
			var index = matches.indexOf ( oldinput );
			matches [ index ] = newinput;
		} else {
			matches.push ( newinput );
		}
	},

	/**
	 * Update input handlers.
	 * @param {edb.Input} input
	 */
	_updatehandlers : function ( input ) {
		var keys = gui.Class.ancestorsAndSelf ( input.type, function ( Type ) {
			var list = this._xxx [ Type.$classid ];
			if ( list ) {
				list.forEach ( function ( checks ) {
					var handler = checks [ 0 ];
					handler.oninput ( input );
				});
			}
		}, this );
	}


}, {}, { // Static .............................................................

	/**
	 * Breakdown argument into array of one or more types.
	 * @param {object} arg
	 * @param {Window} context
	 * @returns {Array<function>}
	 */
	_breakdown : function ( arg, context ) {
		switch ( gui.Type.of ( arg )) {
			case "array" :
				return this._breakarray ( arg, context );
			default :
				return this._breakother ( arg, context );
		}
	},
	
	/**
	 * Breakdown array.
	 * @param {Array<function|String|object>}
	 * @returns {Array<function>}
	 * @param {Window} context
	 * @returns {Array<function>}
	 */
	_breakarray : function ( array, context ) {
		return array.map ( function ( o ) {
			switch ( gui.Type.of ( o )) {
				case "function" :
					return o;
				case "string" :
					return gui.Object.lookup ( o, context );
				case "object" :
					console.error ( "Expected function. Got object." );
			}
		}, this );
	},
	
	/**
	 * Breakdown unarray.
	 * @param {function|String|object} arg
	 * @returns {Array<function>}
	 * @param {Window} context
	 * @returns {Array<function>}
	 */
	_breakother : function ( arg, context ) {
		switch ( gui.Type.of ( arg )) {
			case "function" :
				return [ arg ];
			case "string" :
				return this._breakarray ( arg.split ( " " ), context );
			case "object" :
				console.error ( "Expected function. Got object." );
		}
	},

	/**
	 * Lookup ancestor or identical constructor.
	 * @param {function} target Model constructor
	 * @param {Array<function>} types Model constructors
	 * @returns {function} Model constructor
	 */
	_bestmatch : function ( target, types ) {
		var best = null, rating = Number.MAX_VALUE;
		this._rateall ( target, types, function ( type, rate ) {
			if ( rate >-1 && rate < rating ) {
				best = type;
			}
		});
		return best;
	},

	/**
	 * Match all types.
	 * @param {function} t
	 * @param {Array<function>} types
	 * @param {function} action
	 */
	_rateall : function ( target, types, action ) {
		types.forEach ( function ( type ) {
			action ( type, this._rateone ( target, type ));
		}, this );
	},

	/**
	 * Match single type.
	 * @type {function} t
	 * @type {function} type
	 * @returns {number} -1 for no match
	 */
	_rateone : function ( target, type ) {
		if ( target === type ) {
			return 0;
		} else {
			var tops = gui.Class.ancestorsAndSelf ( target );
			var subs = gui.Class.descendantsAndSelf ( target );
			var itop = tops.indexOf ( type );
			var isub = subs.indexOf ( type );
			return itop < 0 ? isub : itop;
		}
	}

});