// src/components/common/NoDataMessage.jsx
const NoDataMessage = ({ message = 'No data available' }) => {
    return (
      <div id="no-data" className="no-data">
        <h3>No Data Available</h3>
        <p>{message}</p>
      </div>
    );
  };
  
  export default NoDataMessage;