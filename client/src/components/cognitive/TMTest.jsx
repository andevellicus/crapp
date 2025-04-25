import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { formatTime, isMobileDevice } from '../../utils/utils';

const TMTest = ({ onTestEnd, onTestStart, settings, questionId }) => {
  // Default settings
  const DEFAULT_SETTINGS = {
    partAItems: 25, // Items for Part A (configurable)
    partBItems: 25, // Items for Part B (configurable)
    includePartB: true, // Whether to include part B (alternating numbers and letters)
    partATimeLimit: 60000, // Time limit for Part A (configurable)
    partBTimeLimit: 120000, // Time limit for Part B (configurable)
  };

  // Merge settings
  const testSettings = settings ? { ...DEFAULT_SETTINGS, ...settings } : DEFAULT_SETTINGS;
  
  // States
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isPractice, setIsPractice] = useState(true);
  const [currentPart, setCurrentPart] = useState('A');
  const [remainingTime, setRemainingTime] = useState(testSettings.partATimeLimit + testSettings.partBTimeLimit);
  const [items, setItems] = useState([]);
  const [currentItem, setCurrentItem] = useState(1);
  const [errors, setErrors] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [completionTime, setCompletionTime] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [canvasSizeFixed, setCanvasSizeFixed] = useState(false);
  const canvasContainerRef = useRef(null);
  
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

  // Set canvas size once on initial render
  useEffect(() => {
    if (!canvasSizeFixed && canvasContainerRef.current) {
      // Get container dimensions
      const container = canvasContainerRef.current;
      const containerWidth = container.clientWidth;
      
      // Get window dimensions for mobile constraints
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      
      // Calculate optimal size (smaller on mobile)
      const maxWidth = isMobileDevice() 
        ? Math.min(containerWidth - 20, 320) 
        : Math.min(containerWidth - 40, 800);
      
      // Maintain aspect ratio
      const aspectRatio = 3/4; // height/width ratio
      const height = isMobileDevice() 
        ? Math.min(maxWidth, windowHeight) 
        : Math.min(maxWidth * aspectRatio, windowHeight * 0.5);
      
      // Set size and mark as fixed
      setCanvasSize({ 
        width: maxWidth, 
        height: height 
      });
      setCanvasSizeFixed(true);
    }
  }, [canvasSizeFixed, isRunning]);

  // Generate items and draw canvas when test starts or part changes
  useEffect(() => {
    if (isRunning && canvasSizeFixed) {
      generateItems();
      drawCanvas();
    }
  }, [isRunning, currentPart, canvasSizeFixed]);

  // Update canvas after items state changes to ensure immediate visual feedback
  useEffect(() => {
    if (isRunning && items.length > 0) {
      drawCanvas();
    }
  }, [items, currentItem]);
  
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

  // Record interactions with the interaction tracker if available
  useEffect(() => {
    if (isRunning && window.interactionTracker) {
      // The tracker is already initialized in the parent Form component
      // No need to setup here, just ensure cleanup
      return () => {
        if (window.interactionTracker) {
          // Make sure we don't leave any event listeners
        }
      };
    }
  }, [isRunning]);

  // Generate test items (circles with numbers/letters)
  const generateItems = () => {
    const newItems = [];
    const radius = isMobileDevice ? 15 : 20;
    const minDistance = radius * 3; // Minimum distance between circles (3x radius)
    const padding = minDistance; // Padding from edges
    const maxAttempts = 100; // Maximum attempts to find a non-overlapping position

    // Determine number of items based on part and settings
    let numItems;
    if (currentPart === 'Practice') {
      numItems = 5; 
    } else if (currentPart === 'A') {
      numItems = testSettings.partAItems; // Use configurable setting
    } else {
      numItems = testSettings.partBItems; // Use configurable setting
    }
    
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
      
      // Find a position that doesn't overlap with existing items
      let x, y;
      let isOverlapping = true;
      let attempts = 0;
      
      while (isOverlapping && attempts < maxAttempts) {
        // Generate random position, but ensure first item is more centered
        if (i === 1) {
          // Place first item in the top third for better visibility
          x = padding + (canvasSize.width - 2 * padding) * (0.3 + Math.random() * 0.4);
          y = padding + (canvasSize.height - 2 * padding) * (0.2 + Math.random() * 0.3);
        } else {
          x = padding + Math.random() * (canvasSize.width - 2 * padding);
          y = padding + Math.random() * (canvasSize.height - 2 * padding);
        }
        
        // Check if it overlaps with any existing item
        isOverlapping = false;
        for (const existingItem of newItems) {
          const distance = Math.sqrt(
            Math.pow(x - existingItem.x, 2) + 
            Math.pow(y - existingItem.y, 2)
          );
          
          if (distance < minDistance) {
            isOverlapping = true;
            break;
          }
        }
        
        attempts++;
      }
      
      // Adjust if no non-overlapping position after max attempts,
      if (isOverlapping && newItems.length > 0) {
        // Find closest circle
        let closestItem = null;
        let closestDistance = Infinity;
        
        for (const existingItem of newItems) {
          const distance = Math.sqrt(
            Math.pow(x - existingItem.x, 2) + 
            Math.pow(y - existingItem.y, 2)
          );
          
          if (distance < closestDistance) {
            closestDistance = distance;
            closestItem = existingItem;
          }
        }
        
        // If closest circle is too close, move this circle away from it
        if (closestItem && closestDistance < minDistance) {
          const angle = Math.atan2(y - closestItem.y, x - closestItem.x);
          const newDistance = minDistance;
          
          x = closestItem.x + Math.cos(angle) * newDistance;
          y = closestItem.y + Math.sin(angle) * newDistance;
          
          // Make sure it's still within bounds
          x = Math.max(padding, Math.min(canvasSize.width - padding, x));
          y = Math.max(padding, Math.min(canvasSize.height - padding, y));
        }
      }
      
      newItems.push({
        id: i,
        label,
        x,
        y,
        radius: radius,
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
      
      if (item.connected) {
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

    // Track interaction with global tracker if available
    if (window.interactionTracker) {
      try {
        // Record this as a targeted interaction
        window.interactionTracker.handleInteraction(
          {
            target: canvas,
            clientX: e.clientX,
            clientY: e.clientY
          }, 
          {
            id: `tmt-${currentItem}-${currentPart}`,
            questionId: questionId,
            x: x,
            y: y,
            width: 10,
            height: 10,
            type: 'tmt-circle'
          }
        );
      } catch (err) {
        console.error('Error recording TMT interaction:', err);
      }
    }
    
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
    setRemainingTime(testSettings.partATimeLimit + testSettings.partBTimeLimit);
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
    <div className="trail-test-container" ref={canvasContainerRef}>
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
          cursor: 'pointer',
          touchAction: 'none', // Prevent scrolling on touch devices
          maxWidth: '100%'     // Ensure it doesn't overflow
        }}
      />
      <div className="trail-footer">
      {/*   
        <div>Current target: <strong>{
          currentItem <= items.length ? 
            (items[currentItem-1]?.label || '') : 
            'Complete'
        }</strong></div>
      */}
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