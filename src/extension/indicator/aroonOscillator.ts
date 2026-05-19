/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { IndicatorTemplate } from '../../component/Indicator'

interface AroonOscillator {
  osc?: number
}

/**
 * Aroon Oscillator
 * up = 100 * (length - barsSinceHighestHigh) / length
 * down = 100 * (length - barsSinceLowestLow) / length
 * osc = up - down
 */
const aroonOscillator: IndicatorTemplate<AroonOscillator, number> = {
  name: 'AroonOsc',
  shortName: 'Aroon Osc',
  calcParams: [14],
  precision: 2,
  minValue: -100,
  maxValue: 100,
  figures: [{
    key: 'osc',
    title: 'Oscillator: ',
    type: 'line',
    styles: ({ data }) => ({
      color: (data.current?.osc ?? 0) >= 0 ? '#4caf50' : '#ff5252'
    })
  }],
  calc: (dataList, indicator) => {
    const [length] = indicator.calcParams
    return dataList.map((kLineData, i) => {
      const result: AroonOscillator = {}
      if (i < length) {
        return result
      }
      let highestHigh = kLineData.high
      let lowestLow = kLineData.low
      let barsSinceHighestHigh = 0
      let barsSinceLowestLow = 0
      for (let offset = 1; offset <= length; offset++) {
        const data = dataList[i - offset]
        if (data.high > highestHigh) {
          highestHigh = data.high
          barsSinceHighestHigh = offset
        }
        if (data.low < lowestLow) {
          lowestLow = data.low
          barsSinceLowestLow = offset
        }
      }
      const aroonUp = 100 * (length - barsSinceHighestHigh) / length
      const aroonDown = 100 * (length - barsSinceLowestLow) / length
      result.osc = aroonUp - aroonDown
      return result
    })
  }
}

export default aroonOscillator
