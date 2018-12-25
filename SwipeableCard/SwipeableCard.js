import React, { PureComponent } from 'react';
import Animated from 'react-native-reanimated';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

import { 
  influenceAreaWithRadius,
  snapTo,
  springBehavior,
  frictionBehavior,
  anchorBehavior,
  gravityBehavior,
  bounceBehavior,
  withInfluence,
  withLimits
} from './utils';

const {
  add,
  cond,
  diff,
  divide,
  eq,
  event,
  lessThan,
  and,
  call,
  block,
  multiply,
  set,
  abs,
  clockRunning,
  greaterOrEq,
  startClock,
  stopClock,
  Clock,
  Value,
} = Animated;

import {
  ANIMATOR_PAUSE_CONSECUTIVE_FRAMES,
  ANIMATOR_PAUSE_ZERO_VELOCITY,
  DEFAULT_SNAP_TENSION,
  DEFAULT_SNAP_DAMPING,
  DEFAULT_GRAVITY_FALLOF,
} from './constants'


class SwipeableCard extends PureComponent {
  static defaultProps = {
    dragToss: 0.1,
    dragEnabled: true,
    initialPosition: { x: 0, y: 0 },
  };

  constructor(props) {
    super(props);

    const gesture = { x: new Value(0), y: new Value(0) };
    const state = new Value(-1);

    this._onGestureEvent = event([
      {
        nativeEvent: {
          translationX: gesture.x,
          translationY: gesture.y,
          state: state,
        },
      },
    ]);

    const target = {
      x: new Value(props.initialPosition.x || 0),
      y: new Value(props.initialPosition.y || 0),
    };

    const update = {
      x: props.animatedValueX,
      y: props.animatedValueY,
    };

    const clock = new Clock();

    const dt = divide(diff(clock), 1000);

    const obj = {
      vx: new Value(0),
      vy: new Value(0),
      mass: 1,
    };

    const tossedTarget = {
      x: add(target.x, multiply(props.dragToss, obj.vx)),
      y: add(target.y, multiply(props.dragToss, obj.vy)),
    };

    const permBuckets = [[], [], []];

    const addSpring = (anchor, tension, influence, buckets = permBuckets) => {
      buckets[0].push(
        withInfluence(
          influence,
          target,
          springBehavior(dt, target, obj, anchor, tension)
        )
      );
    };

    const addFriction = (damping, influence, buckets = permBuckets) => {
      buckets[1].push(
        withInfluence(
          influence,
          target,
          frictionBehavior(dt, target, obj, damping)
        )
      );
    };

    const addGravity = (
      anchor,
      strength,
      falloff,
      influence,
      buckets = permBuckets
    ) => {
      buckets[0].push(
        withInfluence(
          influence,
          target,
          gravityBehavior(dt, target, obj, anchor, strength, falloff)
        )
      );
    };

    const dragAnchor = { x: new Value(0), y: new Value(0) };
    const dragBuckets = [[], [], []];
    if (props.dragWithSpring) {
      const { tension, damping } = props.dragWithSpring;
      addSpring(dragAnchor, tension, null, dragBuckets);
      addFriction(damping, null, dragBuckets);
    } else {
      dragBuckets[0].push(anchorBehavior(dt, target, obj, dragAnchor));
    }

    const handleStartDrag =
      props.onDrag &&
      call([target.x, target.y], ([x, y]) =>
        props.onDrag({ nativeEvent: { x, y, state: 'start' } })
      );

    const snapBuckets = [[], [], []];
    const snapAnchor = {
      x: new Value(props.initialPosition.x || 0),
      y: new Value(props.initialPosition.y || 0),
      tension: new Value(DEFAULT_SNAP_TENSION),
      damping: new Value(DEFAULT_SNAP_DAMPING),
    };
    const updateSnapTo = snapTo(
      tossedTarget,
      props.snapPoints,
      snapAnchor,
      props.onSnap,
      props.onDrag
    );

    addSpring(snapAnchor, snapAnchor.tension, null, snapBuckets);
    addFriction(snapAnchor.damping, null, snapBuckets);

    if (props.springPoints) {
      props.springPoints.forEach(pt => {
        addSpring(pt, pt.tension, pt.influenceArea);
        if (pt.damping) {
          addFriction(pt.damping, pt.influenceArea);
        }
      });
    }
    if (props.gravityPoints) {
      props.gravityPoints.forEach(pt => {
        const falloff = pt.falloff || DEFAULT_GRAVITY_FALLOF;
        addGravity(pt, pt.strength, falloff, pt.influenceArea);
        if (pt.damping) {
          const influenceArea =
            pt.influenceArea || influenceAreaWithRadius(1.4 * falloff, pt);
          addFriction(pt.damping, influenceArea);
        }
      });
    }
    if (props.frictionAreas) {
      props.frictionAreas.forEach(pt => {
        addFriction(pt.damping, pt.influenceArea);
      });
    }
    if (props.boundaries) {
      snapBuckets[0].push(
        bounceBehavior(
          dt,
          target,
          obj,
          props.boundaries,
          props.boundaries.bounce
        )
      );
    }

    // behaviors can go under one of three buckets depending on their priority
    // we append to each bucket but in Interactable behaviors get added to the
    // front, so we join in reverse order and then reverse the array.
    const sortBuckets = specialBuckets => ({
      x: specialBuckets
        .map((b, idx) => [...permBuckets[idx], ...b].reverse().map(b => b.x))
        .reduce((acc, b) => acc.concat(b), []),
      y: specialBuckets
        .map((b, idx) => [...permBuckets[idx], ...b].reverse().map(b => b.y))
        .reduce((acc, b) => acc.concat(b), []),
    });
    const dragBehaviors = sortBuckets(dragBuckets);
    const snapBehaviors = sortBuckets(snapBuckets);

    const noMovementFrames = {
      x: new Value(
        props.verticalOnly ? ANIMATOR_PAUSE_CONSECUTIVE_FRAMES + 1 : 0
      ),
      y: new Value(
        props.horizontalOnly ? ANIMATOR_PAUSE_CONSECUTIVE_FRAMES + 1 : 0
      ),
    };

    const stopWhenNeeded = cond(
      and(
        greaterOrEq(noMovementFrames.x, ANIMATOR_PAUSE_CONSECUTIVE_FRAMES),
        greaterOrEq(noMovementFrames.y, ANIMATOR_PAUSE_CONSECUTIVE_FRAMES)
      ),
      [
        props.onStop
          ? cond(
              clockRunning(clock),
              call([target.x, target.y], ([x, y]) =>
                props.onStop({ nativeEvent: { x, y } })
              )
            )
          : undefined,
        stopClock(clock),
      ],
      startClock(clock)
    );

    const trans = (axis, vaxis, lowerBound, upperBound) => {
      const dragging = new Value(0);
      const start = new Value(0);
      const x = target[axis];
      const vx = obj[vaxis];
      const anchor = dragAnchor[axis];
      const drag = gesture[axis];
      let advance = cond(
        lessThan(abs(vx), ANIMATOR_PAUSE_ZERO_VELOCITY),
        x,
        add(x, multiply(vx, dt))
      );
      if (props.boundaries) {
        advance = withLimits(
          advance,
          props.boundaries[lowerBound],
          props.boundaries[upperBound]
        );
      }
      const last = new Value(Number.MAX_SAFE_INTEGER);
      const noMoveFrameCount = noMovementFrames[axis];
      const testMovementFrames = cond(
        eq(advance, last),
        set(noMoveFrameCount, add(noMoveFrameCount, 1)),
        [set(last, advance), set(noMoveFrameCount, 0)]
      );
      const step = cond(
        eq(state, State.ACTIVE),
        [
          cond(dragging, 0, [
            handleStartDrag,
            startClock(clock),
            set(dragging, 1),
            set(start, x),
          ]),
          set(anchor, add(start, drag)),
          cond(dt, dragBehaviors[axis]),
        ],
        [
          cond(dragging, [updateSnapTo, set(dragging, 0)]),
          cond(dt, snapBehaviors[axis]),
          testMovementFrames,
          stopWhenNeeded,
        ]
      );
      const wrapStep = props.enabled
        ? cond(props.enabled, step, [set(dragging, 1), stopClock(clock)])
        : step;

      // export some values to be available for imperative commands
      this._dragging[axis] = dragging;
      this._velocity[axis] = vx;

      // update animatedValueX/animatedValueY
      const doUpdateAnReturn = update[axis] ? set(update[axis], x) : x;

      return block([wrapStep, set(x, advance), doUpdateAnReturn]);
    };

    // variables to be used to access reanimated values from imperative commands
    this._dragging = {};
    this._velocity = {};
    this._position = target;
    this._snapAnchor = snapAnchor;

    this._transX = trans('x', 'vx', 'left', 'right');
    this._transY = trans('y', 'vy', 'top', 'bottom');
  }

  render() {
    const { children, style, horizontalOnly, verticalOnly } = this.props;
    return (
      <PanGestureHandler
        maxPointers={1}
        enabled={this.props.dragEnabled}
        onGestureEvent={this._onGestureEvent}
        onHandlerStateChange={this._onGestureEvent}>
        <Animated.View
          style={[
            style,
            {
              transform: [
                {
                  translateX: verticalOnly ? 0 : this._transX,
                  translateY: horizontalOnly ? 0 : this._transY,
                },
              ],
            },
          ]}>
          {children}
        </Animated.View>
      </PanGestureHandler>
    );
  }

  // imperative commands
  setVelocity({ x, y }) {
    if (x !== undefined) {
      this._dragging.x.setValue(1);
      this._velocity.x.setValue(x);
    }
    if (y !== undefined) {
      this._dragging.y.setValue(1);
      this._velocity.y.setValue(y);
    }
  }

  snapTo({ index }) {
    const snapPoint = this.props.snapPoints[index];
    this._snapAnchor.tension.setValue(
      snapPoint.tension || DEFAULT_SNAP_TENSION
    );
    this._snapAnchor.damping.setValue(
      snapPoint.damping || DEFAULT_SNAP_DAMPING
    );
    this._snapAnchor.x.setValue(snapPoint.x || 0);
    this._snapAnchor.y.setValue(snapPoint.y || 0);
    this.props.onSnap &&
      this.props.onSnap({ nativeEvent: { ...snapPoint, index } });
  }

  changePosition({ x, y }) {
    if (x !== undefined) {
      this._dragging.x.setValue(1);
      this._position.x.setValue(x);
    }
    if (y !== undefined) {
      this._dragging.x.setValue(1);
      this._position.y.setValue(y);
    }
  }
}

export default SwipeableCard;
