import * as THREE from 'three'
import { PHYSICS_DICE_CONFIG } from './config'
import { closestQuaternionForTopValue, topFaceFromQuaternion } from './model'
import type { DieEntry } from './runtimeTypes'
import type { PhysicsDiceIndex, PhysicsDiceSet, PhysicsHeldDice } from './types'

const GUIDE = PHYSICS_DICE_CONFIG.scene.guidance

type GuidanceState = { lastNudgeAtMs: number }
export type GuidanceStates = Map<PhysicsDiceIndex, GuidanceState>

export function guideDiceToTargets(
  entries: DieEntry[],
  held: PhysicsHeldDice,
  targetDice: PhysicsDiceSet,
  states: GuidanceStates,
  elapsedMs: number,
) {
  const assignments = assignTargetValues(entries, held, targetDice)
  entries.forEach((entry) => {
    const targetValue = assignments.get(entry.index)
    if (targetValue === undefined) return
    const rotation = entry.body.rotation()
    const current = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
    const target = closestQuaternionForTopValue(targetValue, current)
    const correction = quaternionError(current, target)
    const angular = entry.body.angvel()
    const angularVelocity = new THREE.Vector3(angular.x, angular.y, angular.z)
    const targetOnTop = topFaceFromQuaternion(current) === targetValue

    if (targetOnTop) {
      const dampingImpulse = angularVelocity.multiplyScalar(-GUIDE.targetDamping)
      if (dampingImpulse.lengthSq() > GUIDE.maxTorqueImpulse ** 2) {
        dampingImpulse.setLength(GUIDE.maxTorqueImpulse)
      }
      entry.body.applyTorqueImpulse(dampingImpulse, true)
      return
    }

    const position = entry.body.translation()
    if (position.y >= GUIDE.airborneHeight) {
      const desiredSpeed = Math.min(GUIDE.maxAngularSpeed, correction.angle * GUIDE.angularGain)
      const desiredVelocity = correction.axis.multiplyScalar(desiredSpeed)
      angularVelocity.lerp(desiredVelocity, GUIDE.angularVelocityBlend)
      entry.body.setAngvel(angularVelocity, true)
      return
    }

    const state = states.get(entry.index) ?? { lastNudgeAtMs: -Infinity }
    states.set(entry.index, state)
    if (
      angularVelocity.length() <= GUIDE.nudgeMaxAngularSpeed &&
      elapsedMs - state.lastNudgeAtMs >= GUIDE.nudgeIntervalMs
    ) {
      state.lastNudgeAtMs = elapsedMs
      const linear = entry.body.linvel()
      const desiredSpeed = Math.min(GUIDE.maxAngularSpeed, correction.angle * GUIDE.angularGain)
      entry.body.setLinvel({ x: linear.x * 0.5, y: GUIDE.nudgeLiftSpeed, z: linear.z * 0.5 }, true)
      entry.body.setAngvel(correction.axis.multiplyScalar(desiredSpeed), true)
      return
    }

    const dampingImpulse = angularVelocity.multiplyScalar(-GUIDE.groundDamping)
    if (dampingImpulse.lengthSq() > GUIDE.maxTorqueImpulse ** 2) {
      dampingImpulse.setLength(GUIDE.maxTorqueImpulse)
    }
    entry.body.applyTorqueImpulse(dampingImpulse, true)
  })
}

export function areDiceAtTargets(
  entries: DieEntry[],
  held: PhysicsHeldDice,
  targetDice: PhysicsDiceSet,
) {
  const actual = entries
    .filter((entry) => !held[entry.index])
    .map((entry) => topFaceFromQuaternion(entry.body.rotation()))
    .sort()
  const target = targetDice.filter((_, index) => !held[index]).sort()
  return actual.every((value, index) => value === target[index])
}

export function readTopDice(entries: DieEntry[]): PhysicsDiceSet {
  return entries.map((entry) => topFaceFromQuaternion(entry.body.rotation())) as [
    PhysicsDiceSet[0],
    PhysicsDiceSet[1],
    PhysicsDiceSet[2],
    PhysicsDiceSet[3],
    PhysicsDiceSet[4],
  ]
}

export function quaternionError(current: THREE.QuaternionLike, target: THREE.QuaternionLike) {
  const currentQuaternion = new THREE.Quaternion(current.x, current.y, current.z, current.w)
  const targetQuaternion = new THREE.Quaternion(target.x, target.y, target.z, target.w)
  const error = targetQuaternion.multiply(currentQuaternion.invert()).normalize()
  if (error.w < 0) error.set(-error.x, -error.y, -error.z, -error.w)

  const angle = 2 * Math.acos(THREE.MathUtils.clamp(error.w, -1, 1))
  const sine = Math.sqrt(Math.max(0, 1 - error.w ** 2))
  const axis =
    sine < 0.0001
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(error.x / sine, error.y / sine, error.z / sine)
  return { angle, axis }
}

function assignTargetValues(
  entries: DieEntry[],
  held: PhysicsHeldDice,
  targetDice: PhysicsDiceSet,
) {
  const active = entries.filter((entry) => !held[entry.index])
  const remaining = targetDice.filter((_, index) => !held[index])
  const assignments = new Map<PhysicsDiceIndex, PhysicsDiceSet[number]>()
  const unmatched: DieEntry[] = []

  active.forEach((entry) => {
    const top = topFaceFromQuaternion(entry.body.rotation())
    const match = remaining.indexOf(top)
    if (match < 0) {
      unmatched.push(entry)
      return
    }
    assignments.set(entry.index, top)
    remaining.splice(match, 1)
  })

  unmatched.forEach((entry) => {
    const rotation = entry.body.rotation()
    const current = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
    let bestIndex = 0
    let bestAngle = Infinity
    remaining.forEach((value, index) => {
      const target = closestQuaternionForTopValue(value, current)
      const angle = quaternionError(current, target).angle
      if (angle >= bestAngle) return
      bestAngle = angle
      bestIndex = index
    })
    const [value] = remaining.splice(bestIndex, 1)
    if (value !== undefined) assignments.set(entry.index, value)
  })

  return assignments
}
