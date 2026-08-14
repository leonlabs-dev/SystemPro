import * as echarts from 'echarts/core';
import {
  BarChart,
  GaugeChart,
  GraphChart,
  LineChart,
  LinesChart,
  MapChart,
  PieChart,
  ScatterChart,
  EffectScatterChart,
  SankeyChart,
} from 'echarts/charts';
import {
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
  BarChart,
  GaugeChart,
  GraphChart,
  LineChart,
  LinesChart,
  MapChart,
  PieChart,
  ScatterChart,
  EffectScatterChart,
  SankeyChart,
  CanvasRenderer,
]);

export { echarts };
export type { ECharts, EChartsCoreOption } from 'echarts/core';
