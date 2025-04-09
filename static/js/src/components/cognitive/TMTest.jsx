import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';

const TMTest = ({ onTestEnd, onTestStart, settings, questionId }) => {
  // Default settings
  const DEFAULT_SETTINGS = {
    timeLimit: 60000, // 1 minute in milliseconds
    numItems: 25, // Total dots to connect
    includePartB: true // Whether to include part B (alternating numbers and letters)
  };

  // Merge settings
  const testSettings = settings ? { ...DEFAULT_SETTINGS, ...settings } : DEFAULT_SETTINGS;
  
  // States
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isPractice, setIsPractice] = useState(true);
  const [currentPart, setCurrentPart] = useState('A');
  const [remainingTime, setRemainingTime] = useState(testSettings.timeLimit);
  const [items, setItems] = useState([]);
  const [currentItem, setCurrentItem] = useState(1);
  const [errors, setErrors] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [completionTime, setCompletionTime] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  
  // Refs
  const canvasRef = useRef(null);
  const timerRef = useRef(null);
  const testDataRef = useRef({
    testStartTime: 0,
    testEndTime: 0,
    partAStartTime: 0,
    partAEndTime: 0,
    partBStartTime: 0,
    partBEndTime: 0,
    partAErrors: 0,
    partBErrors: 0,
    partACompletionTime: 0,
    partBCompletionTime: 0,
    clicks: [],
    settings: testSettings
  });
  
  // Resize canvas on window resize
  useEffect(() => {
    const handleResize = () => {
      const container = document.querySelector('.trail-test-container');
      if (container) {
        // Keep it responsive but with max dimensions
        const width = Math.min(container.clientWidth - 40, 800);
        const height = Math.min(window.innerHeight * 0.7, 600);
        setCanvasSize({ width, height });
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial size
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Generate test items when starting
  useEffect(() => {
    if (isRunning) {
      generateItems();
      drawCanvas();
    }
  }, [isRunning, currentPart, canvasSize]);
  
  // Update timer
  useEffect(() => {
    if (isRunning && !isPractice) {
      timerRef.current = setInterval(() => {
        setRemainingTime(prev => {
          if (prev <= 1000) {
            endTest(false); // End test due to timeout
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
      
      return () => clearInterval(timerRef.current);
    }
  }, [isRunning, isPractice]);
  
  // Format time as MM:SS
  const formatTime = (milliseconds) => {
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Generate test items (circles with numbers/letters)
  const generateItems = () => {
    const newItems = [];
    const padding = 50; // Padding from edges
    const numItems = currentPart === 'Practice' ? 10 : testSettings.numItems;
    
    for (let i = 1; i <= numItems; i++) {
      let label;
      
      if (currentPart === 'A' || currentPart === 'Practice') {
        label = i.toString();
      } else if (currentPart === 'B') {
        // For Part B, alternate between numbers and letters
        if (i % 2 === 1) {
          label = Math.ceil(i/2).toString();
        } else {
          // Convert to letter (1=A, 2=B, etc.)
          label = String.fromCharCode(64 + i/2);
        }
      }
      
      newItems.push({
        id: i,
        label,
        x: padding + Math.random() * (canvasSize.width - 2 * padding),
        y: padding + Math.random() * (canvasSize.height - 2 * padding),
        radius: 20,
        connected: false
      });
    }
    
    setItems(newItems);
    setCurrentItem(1);
  };
  
  // Draw the canvas
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || items.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw connecting lines between connected items
    ctx.strokeStyle = '#4a6fa5';
    ctx.lineWidth = 2;
    
    let prevItem = null;
    for (const item of items) {
      if (item.connected && prevItem) {
        ctx.beginPath();
        ctx.moveTo(prevItem.x, prevItem.y);
        ctx.lineTo(item.x, item.y);
        ctx.stroke();
      }
      
      if (item.connected) {
        prevItem = item;
      }
    }
    
    // Draw items (circles)
    for (const item of items) {
      // Circle
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.radius, 0, 2 * Math.PI);
      
      if (item.id === currentItem) {
        // Highlight current target
        ctx.fillStyle = 'rgba(74, 111, 165, 0.7)';
      } else if (item.connected) {
        // Connected items
        ctx.fillStyle = 'rgba(90, 154, 104, 0.5)';
      } else {
        // Not connected yet
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      }
      
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Text
      ctx.fillStyle = '#333';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, item.x, item.y);
    }
  };
  
  // Handle canvas click
  const handleCanvasClick = (e) => {
    if (!isRunning || items.length === 0) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Record click in test data
    testDataRef.current.clicks.push({
      x,
      y,
      time: performance.now() - testDataRef.current.testStartTime,
      targetItem: currentItem,
      currentPart
    });
    
    // Check if clicked on any item
    let clickedItem = null;
    for (const item of items) {
      const distance = Math.sqrt((x - item.x) ** 2 + (y - item.y) ** 2);
      if (distance <= item.radius) {
        clickedItem = item;
        break;
      }
    }
    
    if (clickedItem) {
      if (clickedItem.id === currentItem) {
        // Correct item clicked
        const updatedItems = items.map(item => 
          item.id === currentItem ? { ...item, connected: true } : item
        );
        
        setItems(updatedItems);
        
        // If this was the last item, end the test or move to next part
        if (currentItem === items.length) {
          if (isPractice) {
            // Move from practice to real test
            setIsPractice(false);
            setCurrentPart('A');
            setStartTime(performance.now());
            testDataRef.current.partAStartTime = performance.now() - testDataRef.current.testStartTime;
          } else if (currentPart === 'A' && testSettings.includePartB) {
            // Move from part A to part B
            const endTime = performance.now();
            const elapsedTime = endTime - startTime;
            testDataRef.current.partAEndTime = endTime - testDataRef.current.testStartTime;
            testDataRef.current.partACompletionTime = elapsedTime;
            testDataRef.current.partAErrors = errors;
            
            setCurrentPart('B');
            setStartTime(endTime);
            setErrors(0);
            testDataRef.current.partBStartTime = endTime - testDataRef.current.testStartTime;
          } else {
            // End of test
            const endTime = performance.now();
            const elapsedTime = endTime - startTime;
            
            if (currentPart === 'A') {
              testDataRef.current.partAEndTime = endTime - testDataRef.current.testStartTime;
              testDataRef.current.partACompletionTime = elapsedTime;
              testDataRef.current.partAErrors = errors;
            } else {
              testDataRef.current.partBEndTime = endTime - testDataRef.current.testStartTime;
              testDataRef.current.partBCompletionTime = elapsedTime;
              testDataRef.current.partBErrors = errors;
            }
            
            setCompletionTime(elapsedTime);
            endTest(true); // Successfully completed
          }
        } else {
          // Move to next item
          setCurrentItem(currentItem + 1);
        }
      } else {
        // Wrong item clicked - count as error
        setErrors(errors + 1);
      }
    }
    
    // Redraw canvas
    drawCanvas();
  };
  
  // Start the test
  const startTest = () => {
    // Call onTestStart callback if provided
    if (onTestStart) {
      onTestStart();
    }
    
    // Set initial state
    setIsRunning(true);
    setIsPractice(true);
    setCurrentPart('Practice');
    setRemainingTime(testSettings.timeLimit);
    setErrors(0);
    setCompletionTime(0);
    
    // Record start time
    const startTime = performance.now();
    setStartTime(startTime);
    
    // Initialize test data
    testDataRef.current = {
      testStartTime: startTime,
      testEndTime: 0,
      partAStartTime: 0,
      partAEndTime: 0,
      partBStartTime: 0,
      partBEndTime: 0,
      partAErrors: 0,
      partBErrors: 0,
      partACompletionTime: 0,
      partBCompletionTime: 0,
      clicks: [],
      settings: testSettings
    };
  };
  
  // End the test
  const endTest = (completed = true) => {
    // Stop the test
    setIsRunning(false);
    setIsComplete(true);
    
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Record end time
    const endTime = performance.now();
    testDataRef.current.testEndTime = endTime;
    
    // Call onTestEnd with the results
    if (onTestEnd) {
      onTestEnd(testDataRef.current);
    }
  };
  
  // Render intro screen
  const renderIntroScreen = () => (
    <div className="trail-intro">
      <h3>Trail Making Test</h3>
      <div className="trail-instructions">
        <p>This test measures visual attention and task switching ability.</p>
        <p><strong>Instructions:</strong></p>
        <ul>
          <li>You will see circles with numbers (and letters in Part B)</li>
          <li>Connect the circles in ascending order (1-2-3-...)</li>
          <li>In Part B, alternate between numbers and letters (1-A-2-B-...)</li>
          <li>Work as quickly and accurately as possible</li>
          <li>You'll start with a quick practice round</li>
        </ul>
        <p>Click 'Start Test' when you're ready to begin.</p>
      </div>
      <button className="submit-button" onClick={startTest}>
        Start Test
      </button>
    </div>
  );
  
  // Render test screen
  const renderTestScreen = () => (
    <div className="trail-test-container">
      <div className="trail-header">
        {!isPractice && (
          <div className="trail-timer">
            Time Remaining: {formatTime(remainingTime)}
          </div>
        )}
        <div className="trail-part">
          {isPractice ? 'Practice Round' : `Part ${currentPart}`}
        </div>
        <div className="trail-instructions-small">
          {currentPart === 'A' || isPractice
            ? 'Connect the numbers in order (1-2-3-...)'
            : 'Connect alternating numbers and letters (1-A-2-B-...)'}
        </div>
      </div>
      
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onClick={handleCanvasClick}
        style={{ 
          border: '1px solid #ccc',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          cursor: 'pointer'
        }}
      />
      
      <div className="trail-footer">
        <div>Current target: <strong>{
          currentItem <= items.length ? 
            (items[currentItem-1]?.label || '') : 
            'Complete'
        }</strong></div>
      </div>
    </div>
  );
  
  // Render results screen
  const renderResultsScreen = () => (
    <div className="trail-completion-message">
      <p>Test completed! Your results have been saved.</p>
      <p>You can now proceed to the next question.</p>
    </div>
  );
  
  // Main render
  if (isComplete) {
    return renderResultsScreen();
  } else if (isRunning) {
    return renderTestScreen();
  } else {
    return renderIntroScreen();
  }
};

export default TMTest;