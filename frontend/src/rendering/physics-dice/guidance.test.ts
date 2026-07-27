import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { quaternionError } from './guidance'

describe('physics dice target guidance', () => {
  it('동일한 자세의 회전 오차는 0이다', () => {
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, -0.4, 0.7))

    expect(quaternionError(rotation, rotation).angle).toBeCloseTo(0, 8)
  })

  it('quaternion 부호가 달라도 동일한 자세로 취급한다', () => {
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0.5, -0.2))
    const negated = new THREE.Quaternion(-rotation.x, -rotation.y, -rotation.z, -rotation.w)

    expect(quaternionError(rotation, negated).angle).toBeCloseTo(0, 8)
  })

  it('목표 방향으로의 최단 회전축과 각도를 반환한다', () => {
    const current = new THREE.Quaternion()
    const target = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
    const error = quaternionError(current, target)

    expect(error.angle).toBeCloseTo(Math.PI / 2, 6)
    expect(error.axis.x).toBeCloseTo(1, 6)
  })
})
