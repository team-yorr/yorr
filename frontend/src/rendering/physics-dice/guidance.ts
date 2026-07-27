import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { PHYSICS_DICE_CONFIG } from './config'
import { closestQuaternionForTopValue } from './model'
import type { DieEntry } from './runtimeTypes'
import type { PhysicsDiceIndex, PhysicsDiceSet, PhysicsHeldDice } from './types'

const GUIDE = PHYSICS_DICE_CONFIG.scene.guidance

export type GuidanceTargets = Map<PhysicsDiceIndex, THREE.Quaternion>

export function guideDiceToTargets(
  entries: DieEntry[],
  held: PhysicsHeldDice,
  targetDice: PhysicsDiceSet,
  targets: GuidanceTargets,
  elapsedMs: number,
) {
  entries.forEach((entry) => {
    if (held[entry.index]) return
    const rotation = entry.body.rotation()
    const current = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
    let target = targets.get(entry.index)
    if (!target) {
      target = closestQuaternionForTopValue(targetDice[entry.index], current)
      targets.set(entry.index, target)
    }

    const correction = quaternionError(current, target)
    if (elapsedMs >= GUIDE.orientationLockAfterMs) {
      const nextRotation = stepQuaternionTowardTarget(current, target, GUIDE.rotationStep)
      const position = entry.body.translation()
      const landingY =
        (PHYSICS_DICE_CONFIG.defaults.diceSize * PHYSICS_DICE_CONFIG.scene.bowlDiceScale) / 2 +
        0.025
      entry.body.wakeUp()
      entry.body.setBodyType(RAPIER.RigidBodyType.Fixed, true)
      entry.body.setRotation(nextRotation, true)
      entry.body.setTranslation(
        {
          x: position.x,
          y: THREE.MathUtils.lerp(position.y, landingY, GUIDE.landingStep),
          z: position.z,
        },
        true,
      )
      entry.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      entry.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      return
    }

    const angular = entry.body.angvel()
    const impulse = correction.axis
      .multiplyScalar(Math.min(GUIDE.maxTorqueImpulse, correction.angle * GUIDE.strength))
      .addScaledVector(new THREE.Vector3(angular.x, angular.y, angular.z), -GUIDE.damping)

    if (impulse.lengthSq() > GUIDE.maxTorqueImpulse ** 2) {
      impulse.setLength(GUIDE.maxTorqueImpulse)
    }
    entry.body.wakeUp()
    entry.body.applyTorqueImpulse(impulse, true)
  })
}

export function stepQuaternionTowardTarget(
  current: THREE.QuaternionLike,
  target: THREE.QuaternionLike,
  step: number,
) {
  const targetQuaternion = new THREE.Quaternion(target.x, target.y, target.z, target.w)
  const next = new THREE.Quaternion(current.x, current.y, current.z, current.w).slerp(
    targetQuaternion,
    step,
  )
  return quaternionError(next, targetQuaternion).angle <= GUIDE.angleTolerance
    ? targetQuaternion
    : next
}

export function areDiceAtTargets(
  entries: DieEntry[],
  held: PhysicsHeldDice,
  targets: GuidanceTargets,
) {
  return entries
    .filter((entry) => !held[entry.index])
    .every((entry) => {
      const target = targets.get(entry.index)
      if (!target) return false
      const rotation = entry.body.rotation()
      const current = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
      return quaternionError(current, target).angle <= GUIDE.angleTolerance
    })
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
