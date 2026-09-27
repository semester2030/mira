//
//  DemoLauncherViewController.swift
//  PerfectLibDemo
//
//  Created by Alex Lin on 2019/5/6.
//  Copyright © 2019 Perfect Corp. All rights reserved.
//

import UIKit

enum CellType: String, CaseIterable {
    case CameraKit
}

class LauncherCell: UITableViewCell {
    @IBOutlet weak var titleLabel: UILabel!
    
}

class DemoLauncherViewController: UIViewController, UITableViewDataSource, UITableViewDelegate {
    @IBOutlet weak var tableView: UITableView!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        MemoryUtility.displayMemoryUsage()
        // Isolation run: skip menu and open CameraKit immediately.
        DispatchQueue.main.async { [weak self] in
            self?.navigateTo(.CameraKit)
        }
    }
    
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return CellType.allCases.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell: LauncherCell = tableView.dequeueReusableCell(withIdentifier: "LauncherCell") as! LauncherCell
        cell.titleLabel.text = CellType.allCases[indexPath.row].rawValue
        return cell
    }
    
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let selectedCell = CellType.allCases[indexPath.row]
        navigateTo(selectedCell)
    }
    
    private func navigateTo(_ cell: CellType) {
        let controlName = cell.rawValue
        let controllerName = controlName + "ViewController"
        let storyboard = UIStoryboard.init(name: "Main", bundle: nil)
        let dst = storyboard.instantiateViewController(withIdentifier: controllerName)
        navigationController?.pushViewController(dst, animated: true)
    }
}
