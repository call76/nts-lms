import { asset } from '../services/assets';
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { FaCode, FaNetworkWired, FaMicrochip, FaBroadcastTower, FaVideo, FaBook, FaChevronRight } from 'react-icons/fa';
import api from '../services/api';
import PageHero from '../components/PageHero';

const Courses = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);
  
  // Courses data (this should come from API in production)
  const baseTrades = [
    { 
      id: 1, 
      name: 'Software Development', 
      icon: <FaCode />, 
      color: 'bg-green-500',
      description: 'Learn programming, web development, mobile apps, and software engineering.',
      levels: { 
        1: [
          { code: 'SWD301', name: 'Programming Fundamentals (Python)', description: 'Introduction to programming concepts, variables, control structures, functions, and basic data structures using Python.' },
          { code: 'SWD302', name: 'Web Development Basics', description: 'Learn to create responsive websites using HTML5, CSS3, and JavaScript fundamentals.' },
          { code: 'SWD303', name: 'Database Design and SQL', description: 'Design relational databases, write SQL queries, and understand database normalization.' },
          { code: 'SWD304', name: 'Computer Networking Fundamentals', description: 'Understanding network protocols, OSI model, IP addressing, and network topologies.' },
          { code: 'SWD305', name: 'Operating Systems', description: 'Introduction to operating system concepts, processes, memory management, and file systems.' },
          { code: 'SWD306', name: 'Digital Electronics', description: 'Basic digital logic gates, Boolean algebra, and simple circuit design.' }
        ],
        2: [
          { code: 'SWD401', name: 'Object-Oriented Programming (Java)', description: 'Learn OOP concepts: classes, inheritance, polymorphism, encapsulation, and abstraction using Java.' },
          { code: 'SWD402', name: 'Advanced Web Development', description: 'Build full-stack applications using React.js for frontend and Node.js/Express for backend.' },
          { code: 'SWD403', name: 'Software Engineering Principles', description: 'Software development lifecycle, requirements analysis, design patterns, and testing methodologies.' },
          { code: 'SWD404', name: 'Mobile App Development', description: 'Create mobile applications using React Native or Flutter for iOS and Android platforms.' },
          { code: 'SWD405', name: 'Data Structures and Algorithms', description: 'Study of arrays, linked lists, trees, graphs, sorting, and searching algorithms.' },
          { code: 'SWD406', name: 'Version Control (Git)', description: 'Learn Git commands, branching strategies, and collaborative development workflows.' }
        ],
        3: [
          { code: 'SWD501', name: 'Machine Learning with Python', description: 'Introduction to machine learning algorithms, data preprocessing, model training, and deployment using scikit-learn and TensorFlow.' },
          { code: 'SWD502', name: 'Cloud Computing', description: 'AWS/Azure/GCP fundamentals, cloud deployment, serverless architecture, and containerization with Docker.' },
          { code: 'SWD503', name: 'DevOps and CI/CD', description: 'Continuous integration, continuous deployment, Jenkins, GitHub Actions, and infrastructure as code.' },
          { code: 'SWD504', name: 'Advanced Database Systems', description: 'NoSQL databases, MongoDB, data warehousing, and big data technologies.' },
          { code: 'SWD505', name: 'Cybersecurity Fundamentals', description: 'Security principles, encryption, network security, and ethical hacking basics.' },
          { code: 'SWD506', name: 'Project Management', description: 'Agile methodology, Scrum, project planning, risk management, and team collaboration.' }
        ]
      } 
    },
    { 
      id: 2, 
      name: 'Networking & Internet Technologies', 
      icon: <FaNetworkWired />, 
      color: 'bg-blue-500',
      description: 'Master computer networks, routing, switching, and network security.',
      levels: { 
        1: [
          { code: 'NET301', name: 'Computer Networks Basics', description: 'Introduction to network types, topologies, and basic networking concepts.' },
          { code: 'NET302', name: 'Network Cabling and Hardware', description: 'Network cables, connectors, switches, routers, and network interface cards.' },
          { code: 'NET303', name: 'IP Addressing and Subnetting', description: 'IPv4 and IPv6 addressing, subnet calculation, and CIDR notation.' }
        ],
        2: [
          { code: 'NET401', name: 'Routing and Switching', description: 'Configure routers and switches, static and dynamic routing protocols (RIP, OSPF).' },
          { code: 'NET402', name: 'VLANs and Inter-VLAN Routing', description: 'Virtual LAN configuration, trunking, and routing between VLANs.' },
          { code: 'NET403', name: 'Wireless Networking', description: 'WiFi standards, access point configuration, and wireless security.' },
          { code: 'NET404', name: 'Network Security Fundamentals', description: 'Firewalls, VPNs, ACLs, and network security best practices.' }
        ],
        3: [
          { code: 'NET501', name: 'Advanced Routing', description: 'OSPF, EIGRP, BGP routing protocols and configuration.' },
          { code: 'NET502', name: 'Network Automation', description: 'Automate network tasks using Python scripts and libraries like Netmiko.' },
          { code: 'NET503', name: 'Cloud Networking', description: 'Virtual networks, cloud load balancers, and hybrid cloud connectivity.' },
          { code: 'NET504', name: 'WAN Technologies', description: 'Wide Area Network technologies, MPLS, SD-WAN, and VPN connectivity.' }
        ]
      } 
    },
    { 
      id: 3, 
      name: 'Computer Systems & Architecture', 
      icon: <FaMicrochip />, 
      color: 'bg-purple-500',
      description: 'Understand computer hardware, system design, and embedded systems.',
      levels: { 
        1: [
          { code: 'CSA301', name: 'Computer Hardware Basics', description: 'Identify computer components, their functions, and specifications.' },
          { code: 'CSA302', name: 'PC Assembly and Maintenance', description: 'Assemble, disassemble, troubleshoot, and maintain desktop computers.' },
          { code: 'CSA303', name: 'Operating System Installation', description: 'Install and configure Windows, Linux, and dual-boot systems.' }
        ],
        2: [
          { code: 'CSA401', name: 'Computer System Refurbishment', description: 'Refurbish old computers, upgrade components, and optimize performance.' },
          { code: 'CSA402', name: 'Embedded System Development', description: 'Design and develop embedded systems using Arduino/Raspberry Pi.' },
          { code: 'CSA403', name: 'Firmware Development', description: 'Write firmware for microcontrollers using C/C++.' },
          { code: 'CSA404', name: 'LED/LCD Screen Setup', description: 'Configure and program LED and LCD displays for various applications.' }
        ],
        3: [
          { code: 'CSA501', name: 'Advanced Computer Architecture', description: 'CPU design, pipelining, cache memory, and parallel processing.' },
          { code: 'CSA502', name: 'Microcontrollers and IoT', description: 'Internet of Things concepts, sensor integration, and data collection.' },
          { code: 'CSA503', name: 'System Integration', description: 'Integrate hardware and software components into complete systems.' }
        ]
      } 
    },
    { 
      id: 4, 
      name: 'Electronics & Telecommunication', 
      icon: <FaBroadcastTower />, 
      color: 'bg-yellow-500',
      description: 'Learn electronics, telecommunications, and signal processing.',
      levels: { 
        1: [
          { code: 'ELC301', name: 'Basic Electronics', description: 'Introduction to electronic components, circuits, and soldering techniques.' },
          { code: 'ELC302', name: 'Analog Circuits', description: 'Study of amplifiers, oscillators, filters, and power supplies.' }
        ],
        2: [
          { code: 'ELC401', name: 'Digital Electronics', description: 'Digital logic circuits, counters, registers, and microcontrollers.' },
          { code: 'ELC402', name: 'Telecommunication Systems', description: 'Voice and data communication systems, modems, and multiplexing.' },
          { code: 'ELC403', name: 'Fiber Optics', description: 'Fiber optic cables, connectors, splicing, and optical networks.' }
        ],
        3: [
          { code: 'ELC501', name: 'Advanced Telecommunications', description: 'Cellular networks, VoIP, and next-generation telecom systems.' },
          { code: 'ELC502', name: 'Satellite Communication', description: 'Satellite systems, antennas, and ground station setup.' },
          { code: 'ELC503', name: 'Signal Processing', description: 'Digital signal processing techniques and applications.' }
        ]
      } 
    },
    { 
      id: 5, 
      name: 'Multimedia & Production', 
      icon: <FaVideo />, 
      color: 'bg-red-500',
      description: 'Master graphic design, video editing, animation, and digital content.',
      levels: { 
        1: [
          { code: 'MUL301', name: 'Graphic Design Basics', description: 'Learn Photoshop, Illustrator, and design principles.' },
          { code: 'MUL302', name: 'Video Editing Fundamentals', description: 'Adobe Premiere Pro basics, cutting, transitions, and effects.' },
          { code: 'MUL303', name: 'Audio Production', description: 'Audio recording, editing, mixing using Audacity or Adobe Audition.' }
        ],
        2: [
          { code: 'MUL401', name: '3D Animation', description: 'Blender basics, 3D modeling, texturing, and animation.' },
          { code: 'MUL402', name: 'Web Design (UI/UX)', description: 'User interface design, wireframing, prototyping using Figma.' },
          { code: 'MUL403', name: 'Motion Graphics', description: 'After Effects, keyframe animation, and visual effects.' }
        ],
        3: [
          { code: 'MUL501', name: 'Advanced Video Production', description: 'Cinematography, color grading, and professional video production.' },
          { code: 'MUL502', name: 'Virtual Reality Content', description: 'Create VR content using Unity and 360-degree video.' },
          { code: 'MUL503', name: 'Digital Marketing', description: 'SEO, social media marketing, content strategy, and analytics.' }
        ]
      } 
    }
  ];
  
  // Modules that admins add in the Admin Panel are stored in the database; merge them
  // on top of the built-in TVET curriculum above so students can actually see them.
  const [apiTrades, setApiTrades] = useState([]);
  useEffect(() => {
    api.get('/trades')
      .then(res => setApiTrades(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const iconMap = { FaCode: <FaCode />, FaNetworkWired: <FaNetworkWired />, FaMicrochip: <FaMicrochip />, FaBroadcastTower: <FaBroadcastTower />, FaVideo: <FaVideo /> };
  const tradesData = (() => {
    const merged = baseTrades.map(t => ({ ...t, levels: { 1: [...(t.levels[1] || [])], 2: [...(t.levels[2] || [])], 3: [...(t.levels[3] || [])] } }));
    apiTrades.forEach(at => {
      let target = merged.find(t => t.name.toLowerCase() === at.name.toLowerCase());
      if (!target) {
        target = { id: `db-${at.id}`, name: at.name, icon: iconMap[at.icon] || <FaBook />, color: at.color || 'bg-green-500', description: at.description || '', levels: { 1: [], 2: [], 3: [] } };
        merged.push(target);
      }
      [1, 2, 3].forEach(level => {
        (at.levels?.[level] || []).forEach(m => {
          if (!target.levels[level].some(x => x.code === m.code)) target.levels[level].push({ code: m.code, name: m.name, description: m.description || '' });
        });
      });
    });
    return merged;
  })();
  
  const getLevelName = (level) => {
    switch(level) {
      case 1: return 'Level 3';
      case 2: return 'Level 4';
      case 3: return 'Level 5';
      default: return `Level ${level + 2}`;
    }
  };
  
  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nts-green-600"></div></div>;
  }
  
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <PageHero slot="coursesHero" title="Courses & Modules" subtitle="Explore all available courses across different trades and levels" />
      
      {!selectedTrade ? (
        // Show trades grid
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tradesData.map(trade => (
            <div key={trade.id} className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition cursor-pointer" onClick={() => setSelectedTrade(trade)}>
              <div className={`${trade.color} p-4 text-white`}>
                <div className="flex items-center space-x-3">
                  <div className="text-3xl">{trade.icon}</div>
                  <div>
                    <h3 className="text-xl font-bold">{trade.name}</h3>
                    <p className="text-sm opacity-90 mt-1">{trade.description}</p>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Level 3: {trade.levels[1]?.length || 0} modules</span>
                  <span>Level 4: {trade.levels[2]?.length || 0} modules</span>
                  <span>Level 5: {trade.levels[3]?.length || 0} modules</span>
                </div>
                <button className="mt-3 w-full py-2 border border-nts-green-600 text-nts-green-600 rounded-lg font-medium hover:bg-nts-green-50 transition flex items-center justify-center space-x-2">
                  <span>View Courses</span>
                  <FaChevronRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Show levels and modules for selected trade
        <div>
          <button onClick={() => { setSelectedTrade(null); setSelectedLevel(null); }} className="mb-4 flex items-center space-x-2 text-nts-green-600 hover:text-nts-green-700">
            <FaChevronRight className="rotate-180" size={16} />
            <span>Back to all trades</span>
          </button>
          
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className={`${selectedTrade.color} p-4 text-white`}>
              <div className="flex items-center space-x-3">
                <div className="text-3xl">{selectedTrade.icon}</div>
                <div>
                  <h2 className="text-2xl font-bold">{selectedTrade.name}</h2>
                  <p className="text-sm opacity-90 mt-1">{selectedTrade.description}</p>
                </div>
              </div>
            </div>
            
            <div className="p-4">
              {!selectedLevel ? (
                // Show levels
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map(level => (
                    selectedTrade.levels[level]?.length > 0 && (
                      <div key={level} className="border rounded-lg p-4 hover:shadow-md transition cursor-pointer" onClick={() => setSelectedLevel(level)}>
                        <h3 className="text-lg font-bold text-gray-800">{getLevelName(level)}</h3>
                        <p className="text-gray-500 text-sm mt-1">{selectedTrade.levels[level].length} modules</p>
                        <button className="mt-3 text-nts-green-600 text-sm font-medium">View modules →</button>
                      </div>
                    )
                  ))}
                </div>
              ) : (
                // Show modules for selected level
                <div>
                  <button onClick={() => setSelectedLevel(null)} className="mb-4 flex items-center space-x-2 text-nts-green-600 hover:text-nts-green-700">
                    <FaChevronRight className="rotate-180" size={14} />
                    <span>Back to levels</span>
                  </button>
                  
                  <h3 className="text-xl font-bold text-gray-800 mb-4">{getLevelName(selectedLevel)} Modules</h3>
                  
                  <div className="space-y-3">
                    {selectedTrade.levels[selectedLevel].map(module => (
                      <div key={module.code} className="bg-gray-50 rounded-lg p-4 border hover:shadow-sm transition">
                      {module.coverUrl && <img src={asset(module.coverUrl)} alt="" className="mb-3 h-32 w-full rounded-lg object-cover" loading="lazy" />}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="px-2 py-1 bg-nts-green-100 text-nts-green-700 text-xs font-bold rounded">{module.code}</span>
                              <h4 className="font-semibold text-gray-800">{module.name}</h4>
                            </div>
                            <p className="text-gray-600 text-sm mt-2">{module.description}</p>
                      {module.hours ? <p className="text-xs text-gray-400 mt-1">{module.hours} learning hours</p> : null}
                      {module.introVideoUrl && <video src={asset(module.introVideoUrl)} controls preload="none" className="mt-3 w-full rounded-lg bg-black" />}
                          </div>
                          <FaBook className="text-nts-green-500 flex-shrink-0" size={20} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">📚 Total: {tradesData.reduce((total, trade) => total + (trade.levels[1]?.length || 0) + (trade.levels[2]?.length || 0) + (trade.levels[3]?.length || 0), 0)} modules across all trades. Based on Rwanda TVET Curriculum standards.</p>
      </div>
    </div>
  );
};

export default Courses;