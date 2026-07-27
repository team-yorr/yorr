const roomCodePattern = /^[A-Z0-9]{4,12}$/

export const ROOM_CODE_MAX_LENGTH = 12

export function normalizeRoomCode(value: string) {
  return value.trim().toUpperCase()
}

/** 랜딩 코드 입력은 타이핑·붙여넣기 즉시 정규화한다: 대문자 영숫자만, 최대 길이까지. */
export function sanitizeRoomCodeInput(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ROOM_CODE_MAX_LENGTH)
}

export function isCompleteRoomCode(value: string) {
  return getRoomCodeError(value) === null
}

export function getRoomCodeError(value: string) {
  if (value.length === 0) return '초대 코드를 입력해 주세요.'
  if (!roomCodePattern.test(value)) return '초대 코드는 영문과 숫자 4~12자로 입력해 주세요.'
  return null
}
