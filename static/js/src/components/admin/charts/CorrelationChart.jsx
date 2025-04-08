// src/components/admin/charts/CorrelationChart.jsx
import { Scatter } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ScatterController
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ScatterController
);

const CorrelationChart = ({ data }) => {
  if (!data) return null;

  return (
    <div className="chart-container">
      <Scatter 
        data={data.data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: data.title
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: data.xLabel
              }
            },
            y: {
              title: {
                display: true,
                text: data.yLabel
              }
            }
          }
        }}
      />
    </div>
  );
};

export default CorrelationChart;