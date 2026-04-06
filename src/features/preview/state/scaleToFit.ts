import { useEffect, useState, type RefObject } from 'react'

export interface ScaleToFitInput {
  availableWidth: number
  textWidth: number
  fitInBox?: boolean
  minScaleX?: number
}

export interface UseScaleToFitInput {
  availableWidth: number
  fitInBox?: boolean
  minScaleX?: number
  measureRef: RefObject<HTMLElement>
  epsilon?: number
  dependencies?: readonly unknown[]
}

const defaultScaleX = 1
const defaultEpsilon = 0.001

export function calculateScaleToFit(input: ScaleToFitInput): number {
  if (!input.fitInBox) {
    return defaultScaleX
  }

  if (input.availableWidth <= 0 || input.textWidth <= 0) {
    return defaultScaleX
  }

  const unclampedScale = Math.min(defaultScaleX, input.availableWidth / input.textWidth)
  const minScaleX = input.minScaleX ?? 0

  return Math.max(minScaleX, unclampedScale)
}

export function areScaleValuesEqual(
  left: number,
  right: number,
  epsilon = defaultEpsilon,
): boolean {
  return Math.abs(left - right) <= epsilon
}

export function measureTextWidth(element: HTMLElement | null): number {
  if (!element) {
    return 0
  }

  return element.scrollWidth
}

export function useScaleToFit(input: UseScaleToFitInput): number {
  const {
    availableWidth,
    fitInBox,
    minScaleX,
    measureRef,
    epsilon = defaultEpsilon,
    dependencies = [],
  } = input
  const [scaleX, setScaleX] = useState(defaultScaleX)

  useEffect(() => {
    const nextScaleX = calculateScaleToFit({
      availableWidth,
      textWidth: measureTextWidth(measureRef.current),
      fitInBox,
      minScaleX,
    })

    setScaleX((currentScaleX) =>
      areScaleValuesEqual(currentScaleX, nextScaleX, epsilon) ? currentScaleX : nextScaleX,
    )
  }, [availableWidth, epsilon, fitInBox, measureRef, minScaleX, ...dependencies])

  return scaleX
}
