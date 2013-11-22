/**
 * Tracking EDB input. Note that the {edb.Script} is using this plugin: Don't assume a spirit around here.
 * @extends {gui.Tracker}
 */
edb.InputPlugin = gui.Tracker.extend ({
   
	/**
	 * True when one of each expected input type has been collected.
	 * @type {boolean}
	 */
	done : true,

	/**
	 * Construction time.
	 * @overrides {gui.Tracker#construct}
	 */
	onconstruct : function () {
		this._super.onconstruct ();
		this.context = self; // @TODO: deprecate this whole thing...
		this._watches = [];
		this._matches = [];
		this._needing = [];
	},

	/**
	 * Destruction time.
	 */
	ondestruct : function () {
		this._super.ondestruct ();
		this.remove ( this._watches );
	},
	
	/**
	 * Add handler for one or more input types.
	 * @param {edb.Type|String|Array<edb.Type|String>} arg 
	 * @param @optional {IInputHandler} handler Defaults to this.spirit
	 * @param @optional {IInputHandler} handler Defaults to this.spirit
	 * @returns {gui.InputPlugin}
	 */
	add : gui.Combo.chained ( function ( arg, handler, required ) {
		handler = handler ? handler : this.spirit;
		arg = edb.InputPlugin._breakdown ( arg, this.context );
		if ( arg.length ) {
			this.done = this.done && required === false;
			this._add ( arg, handler, required );
			this._subscribe ( true );
		}
	}),


	/**
	 * Remove handler for one or more input types.
	 * @TODO Cleanup more stuff?
	 * @param {edb.Type|String|Array<edb.Type|String>} arg 
	 * @param @optional {IInputHandler} handler Defaults to this.spirit
	 * @returns {gui.InputPlugin}
	 */
	remove : gui.Combo.chained ( function ( arg, handler ) {
		handler = handler ? handler : this.spirit;
		arg = edb.InputPlugin._breakdown ( arg, this.context );
		if ( arg.length ) {
			this._remove ( arg, handler );
			this.done = this._done ();
		}
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
		if ( b.type === edb.BROADCAST_OUTPUT ) {
			this.match ( b.data );
		}
	},

	/**
	 * Collect matching input.
	 * @param {edb.Input} input
	 */
	match : function ( input ) {
		if ( this._matches.every ( function ( match ) {
			return match.$instanceid !== input.$instanceid;
		})) {
			this._maybeinput ( input );
		}
	},
	
	
	// PRIVATES ...............................................................................
	
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
	 * ?
	 */
	_needing : null,

	/**
	 * Add input handler for types.
	 * @param {Array<function>} types
	 * @param {IInputHandler} handler
	 * @param {boolean} required
	 */
	_add : function ( types, handler, required ) {
		types.forEach ( function ( Type ) {
			if ( gui.Type.isDefined ( Type )) {
				this._addchecks ( Type.$classid, [ handler ]);
				this._watches.push ( Type );
				if ( required ) {
					this._needing.push ( Type );
				}
			} else {
				throw new TypeError ( "Could not register input for undefined Type" );
			}
		}, this );
		types.forEach ( function ( Type ) {
			if ( Type.out ( this.context )) { // type has been output already?
				this._maybeinput ( edb.Output.$get ( Type, this.context ));
			}
		}, this );
	},

	/**
	 * Remove input handler for types.
	 * @param {Array<function>} types
	 * @param {IInputHandler} handler
	 */
	_remove : function ( types, handler ) {
		types.forEach ( function ( Type ) {
			gui.Array.remove ( this._watches, Type );
			gui.Array.remove ( this._needing, Type );
			this._removechecks ( Type.$classid, [ handler ]);
			if ( !this._watches.length ) {
				this._subscribe ( false );
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
			this.done = this._done ();
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
		gui.Class.ancestorsAndSelf ( input.type, function ( Type ) {
			var list = this._trackedtypes [ Type.$classid ];
			if ( list ) {
				list.forEach ( function ( checks ) {
					var handler = checks [ 0 ];
					handler.oninput ( input );
				});
			}
		}, this );
	},

	/**
	 * Required inputs was required?
	 * @returns {boolean}
	 */
	_done : function () {
		var needs = this._needing;
		var haves = this._matches;
		return needs.every ( function ( Type ) {
			return haves.some ( function ( input ) {
				return ( input.data instanceof Type );
			});
		});
	},

	/**
	 * @param {boolean} is
	 */
	_subscribe : function ( is ) {
		gui.Broadcast [ is ? "add" : "remove" ] ( edb.BROADCAST_OUTPUT, this, this.context.gui.$contextid );
	}


}, {}, { // Static .............................................................

	/**
	 * Breakdown argument into array of one or more types.
	 * @param {object} arg
	 * @param {Window} context
	 * @returns {Array<function>}
	 */
	_breakdown : function ( arg, context ) {
		if ( gui.Type.isArray ( arg )) {
			return this._breakarray ( arg, context );
		} else {
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
	 * @param {function} target type constructor
	 * @param {Array<function>} types type constructors
	 * @returns {function} type constructor
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